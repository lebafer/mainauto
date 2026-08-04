import { Hono } from "hono";
import { prisma } from "../prisma";
import {
  getCurrentDealerId,
  getCurrentEntitlements,
  requireDealerRole,
} from "../lib/request-context";
import { fromCents, toCents } from "../lib/money";
import { FinancesDateRangeSchema } from "../types";
import { getBerlinDateRange } from "../lib/financeDates";
import { calculateStockDays } from "../lib/stockDays";

const financesRouter = new Hono();

const EXPORT_COST_FIELDS = [
  { key: "transportCostDomestic", label: "Transport Inland" },
  { key: "transportCostAbroad", label: "Transport Ausland" },
  { key: "customsDuties", label: "Zollgebuehren" },
  { key: "registrationFees", label: "Zulassungsgebuehren" },
  { key: "repairCostsAbroad", label: "Reparaturen im Ausland" },
] as const;

function normalizeAmount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function amountCents(value: number | null | undefined): number {
  return toCents(normalizeAmount(value));
}

function getManualAdditionalCosts(vehicle: {
  costs: Array<{ amount: number }>;
}): number {
  return fromCents(vehicle.costs.reduce((sum, cost) => sum + amountCents(cost.amount), 0));
}

function getExportAdditionalCosts(vehicle: {
  exportEnabled?: boolean | null;
  transportCostDomestic?: number | null;
  transportCostAbroad?: number | null;
  customsDuties?: number | null;
  registrationFees?: number | null;
  repairCostsAbroad?: number | null;
}): number {
  const totalCents = EXPORT_COST_FIELDS.reduce((sum, { key }) => {
    if (key !== "transportCostDomestic" && !vehicle.exportEnabled) {
      return sum;
    }

    return sum + amountCents(vehicle[key]);
  }, 0);
  return fromCents(totalCents);
}

// GET /api/finances?from=ISO_DATE&to=ISO_DATE
financesRouter.get("/", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) return forbidden;

  const dealerId = getCurrentDealerId(c);
  const privateVehiclesEnabled = getCurrentEntitlements(c).private_vehicles === true;
  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");

  const parsedRange = FinancesDateRangeSchema.safeParse({
    from: fromParam,
    to: toParam,
  });
  if (!parsedRange.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Datumsfilter müssen gültige Daten im Format YYYY-MM-DD sein",
        },
      },
      400
    );
  }
  const { fromDate, toDateExclusive } = getBerlinDateRange(parsedRange.data);

  if (fromDate && toDateExclusive && fromDate >= toDateExclusive) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Das Startdatum darf nicht nach dem Enddatum liegen",
        },
      },
      400
    );
  }

  const saleDateFilter =
    fromDate || toDateExclusive
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDateExclusive ? { lt: toDateExclusive } : {}),
        }
      : undefined;

  const createdAtFilter =
    fromDate || toDateExclusive
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDateExclusive ? { lt: toDateExclusive } : {}),
        }
      : undefined;

  // --- Sales in period ---
  const salesInPeriod = await prisma.sale.findMany({
    where: {
      dealerId,
      status: "completed",
      ...(privateVehiclesEnabled ? { vehicle: { isPrivate: false } } : {}),
      ...(saleDateFilter ? { saleDate: saleDateFilter } : {}),
    },
    include: {
      vehicle: {
        select: {
          vehicleNumber: true,
          brand: true,
          model: true,
          purchaseDate: true,
          createdAt: true,
        },
      },
      customer: true,
    },
    orderBy: { saleDate: "desc" },
  });

  // --- Vehicles purchased (created) in period ---
  const vehiclesBoughtInPeriod = await prisma.vehicle.findMany({
    where: {
      dealerId,
      ...(privateVehiclesEnabled ? { isPrivate: false } : {}),
      ...(createdAtFilter
        ? {
            OR: [
              { purchaseDate: createdAtFilter },
              { purchaseDate: null, createdAt: createdAtFilter },
            ],
          }
        : {}),
    },
    include: { costs: true },
  });

  // --- Vehicles currently in stock (not sold, regardless of date filter) ---
  const vehiclesInStock = await prisma.vehicle.findMany({
    where: {
      dealerId,
      ...(privateVehiclesEnabled ? { isPrivate: false } : {}),
      status: { not: "sold" },
    },
    select: {
      vehicleNumber: true,
      brand: true,
      model: true,
      purchasePrice: true,
      purchaseDate: true,
      createdAt: true,
    },
  });

  // --- Compute purchases aggregates ---
  const vehiclesBoughtCount = vehiclesBoughtInPeriod.length;
  const totalPurchaseCostCents = vehiclesBoughtInPeriod.reduce(
    (sum, v) => sum + amountCents(v.purchasePrice),
    0
  );
  const totalManualCostsCents = vehiclesBoughtInPeriod.reduce(
    (sum, v) => sum + toCents(getManualAdditionalCosts(v)),
    0
  );
  const totalExportCostsCents = vehiclesBoughtInPeriod.reduce(
    (sum, v) => sum + toCents(getExportAdditionalCosts(v)),
    0
  );
  const totalAdditionalCostsCents = totalManualCostsCents + totalExportCostsCents;
  const totalPurchaseCost = fromCents(totalPurchaseCostCents);
  const totalManualCosts = fromCents(totalManualCostsCents);
  const totalExportCosts = fromCents(totalExportCostsCents);
  const totalAdditionalCosts = fromCents(totalAdditionalCostsCents);

  // --- Compute sales aggregates ---
  const vehiclesSoldCount = salesInPeriod.length;
  // Per-sale profit calculation
  type SaleRow = {
    id: string;
    saleDate: string;
    vehicleNumber: string;
    brand: string;
    model: string;
    accountingStatus: "verified" | "legacy_snapshot" | "legacy_ambiguous";
    purchasePrice: number | null;
    manualAdditionalCosts: number | null;
    exportAdditionalCosts: number | null;
    additionalCosts: number | null;
    costBreakdown: Array<{
      label: string;
      amount: number;
      category: "manual" | "export";
    }>;
    salePrice: number | null;
    grossSalePrice: number | null;
    netSalePrice: number | null;
    saleTaxAmount: number | null;
    disclosedTaxAmount: number | null;
    marginTaxAmount: number | null;
    profit: number | null;
    customerName: string;
    stockDays: number | null;
  };

  const saleRows: SaleRow[] = salesInPeriod.map((sale) => {
    const hasCompleteSnapshot =
      sale.grossCents !== null &&
      sale.netCents !== null &&
      sale.taxCents !== null &&
      sale.marginTaxCents !== null &&
      sale.purchasePriceCents !== null &&
      sale.manualCostsCents !== null &&
      sale.exportCostsCents !== null &&
      sale.totalCostCents !== null;
    const grossSalePrice = hasCompleteSnapshot ? fromCents(sale.grossCents!) : null;
    const netSalePrice = hasCompleteSnapshot ? fromCents(sale.netCents!) : null;
    const disclosedTaxAmount = hasCompleteSnapshot ? fromCents(sale.taxCents!) : null;
    const marginTaxAmount = hasCompleteSnapshot ? fromCents(sale.marginTaxCents!) : null;
    const saleTaxAmount =
      hasCompleteSnapshot
        ? fromCents(sale.taxCents! + sale.marginTaxCents!)
        : null;
    const purchasePrice = hasCompleteSnapshot ? fromCents(sale.purchasePriceCents!) : null;
    const manualAdditionalCosts = hasCompleteSnapshot ? fromCents(sale.manualCostsCents!) : null;
    const exportAdditionalCosts = hasCompleteSnapshot ? fromCents(sale.exportCostsCents!) : null;
    const additionalCosts =
      hasCompleteSnapshot
        ? fromCents(sale.manualCostsCents! + sale.exportCostsCents!)
        : null;
    const profit =
      hasCompleteSnapshot
        ? fromCents(sale.netCents! - sale.totalCostCents!)
        : null;
    const customerName =
      `${sale.customer.firstName} ${sale.customer.lastName}`.trim();

    return {
      id: sale.id,
      saleDate: sale.saleDate.toISOString(),
      vehicleNumber: sale.vehicle.vehicleNumber,
      brand: sale.vehicle.brand,
      model: sale.vehicle.model,
      accountingStatus: sale.accountingStatus,
      purchasePrice,
      manualAdditionalCosts,
      exportAdditionalCosts,
      additionalCosts,
      costBreakdown: [
        ...(manualAdditionalCosts && manualAdditionalCosts > 0
          ? [{ label: "Zusatzkosten (Snapshot)", amount: manualAdditionalCosts, category: "manual" as const }]
          : []),
        ...(exportAdditionalCosts && exportAdditionalCosts > 0
          ? [{ label: "Exportkosten (Snapshot)", amount: exportAdditionalCosts, category: "export" as const }]
          : []),
      ],
      salePrice: grossSalePrice,
      grossSalePrice,
      netSalePrice,
      saleTaxAmount,
      disclosedTaxAmount,
      marginTaxAmount,
      profit,
      customerName,
      stockDays: calculateStockDays(
        sale.vehicle.purchaseDate ?? sale.vehicle.createdAt,
        sale.saleDate
      ),
    };
  });

  const accountedSaleRows = saleRows.filter(
    (sale): sale is SaleRow & {
      grossSalePrice: number;
      netSalePrice: number;
      saleTaxAmount: number;
      disclosedTaxAmount: number;
      marginTaxAmount: number;
      profit: number;
    } =>
      sale.grossSalePrice !== null &&
      sale.netSalePrice !== null &&
      sale.saleTaxAmount !== null &&
      sale.disclosedTaxAmount !== null &&
      sale.marginTaxAmount !== null &&
      sale.profit !== null
  );
  const totalGrossRevenueCents = accountedSaleRows.reduce((sum, s) => sum + toCents(s.grossSalePrice), 0);
  const totalNetRevenueCents = accountedSaleRows.reduce((sum, s) => sum + toCents(s.netSalePrice), 0);
  const totalSalesTaxCents = accountedSaleRows.reduce((sum, s) => sum + toCents(s.saleTaxAmount), 0);
  const totalDisclosedSalesTaxCents = accountedSaleRows.reduce(
    (sum, sale) => sum + toCents(sale.disclosedTaxAmount),
    0
  );
  const totalMarginTaxCents = accountedSaleRows.reduce(
    (sum, sale) => sum + toCents(sale.marginTaxAmount),
    0
  );
  const totalProfitCents = accountedSaleRows.reduce((sum, s) => sum + toCents(s.profit), 0);
  const totalGrossRevenue = fromCents(totalGrossRevenueCents);
  const totalNetRevenue = fromCents(totalNetRevenueCents);
  const totalSalesTax = fromCents(totalSalesTaxCents);
  const totalDisclosedSalesTax = fromCents(totalDisclosedSalesTaxCents);
  const totalMarginTax = fromCents(totalMarginTaxCents);
  const totalRevenue = totalGrossRevenue;
  const totalProfit = fromCents(totalProfitCents);
  const profitableSales = accountedSaleRows.filter((s) => s.profit > 0).length;
  const lossSales = accountedSaleRows.filter((s) => s.profit <= 0).length;

  // Best sale (highest profit)
  let bestSale: {
    vehicleNumber: string;
    brand: string;
    model: string;
    profit: number;
  } | null = null;

  if (accountedSaleRows.length > 0) {
    const best = accountedSaleRows.reduce((prev, curr) =>
      curr.profit > prev.profit ? curr : prev
    );
    bestSale = {
      vehicleNumber: best.vehicleNumber,
      brand: best.brand,
      model: best.model,
      profit: best.profit,
    };
  }

  // --- Stock aggregates ---
  const vehiclesInStockCount = vehiclesInStock.length;
  const stockValue = fromCents(
    vehiclesInStock.reduce((sum, v) => sum + amountCents(v.purchasePrice), 0)
  );
  const stockAgeRows = vehiclesInStock.map((vehicle) => ({
    vehicleNumber: vehicle.vehicleNumber,
    brand: vehicle.brand,
    model: vehicle.model,
    stockDays: calculateStockDays(vehicle.purchaseDate ?? vehicle.createdAt) ?? 0,
  }));
  const averageStockDays =
    stockAgeRows.length > 0
      ? Math.round(stockAgeRows.reduce((sum, v) => sum + v.stockDays, 0) / stockAgeRows.length)
      : 0;
  const longestStockVehicle =
    stockAgeRows.length > 0
      ? stockAgeRows.reduce((prev, curr) => (curr.stockDays > prev.stockDays ? curr : prev))
      : null;
  const maxStockDays = longestStockVehicle?.stockDays ?? 0;
  const soldStockDays = saleRows
    .map((sale) => sale.stockDays)
    .filter((days): days is number => days !== null);
  const averageSoldStockDays =
    soldStockDays.length > 0
      ? Math.round(soldStockDays.reduce((sum, days) => sum + days, 0) / soldStockDays.length)
      : 0;

  return c.json({
    data: {
      vehiclesBought: vehiclesBoughtCount,
      totalPurchaseCost,
      totalManualCosts,
      totalExportCosts,
      totalAdditionalCosts,
      vehiclesSold: vehiclesSoldCount,
      accountedSales: accountedSaleRows.length,
      ambiguousSales: saleRows.filter((sale) => sale.accountingStatus === "legacy_ambiguous").length,
      legacySnapshotSales: saleRows.filter((sale) => sale.accountingStatus === "legacy_snapshot").length,
      hasAccountingWarnings: saleRows.some((sale) => sale.accountingStatus !== "verified"),
      totalRevenue,
      totalGrossRevenue,
      totalNetRevenue,
      totalSalesTax,
      totalDisclosedSalesTax,
      totalMarginTax,
      totalProfit,
      profitableSales,
      lossSales,
      vehiclesInStock: vehiclesInStockCount,
      stockValue,
      averageStockDays,
      maxStockDays,
      longestStockVehicle,
      averageSoldStockDays,
      bestSale,
      sales: saleRows,
    },
  });
});

export { financesRouter };
