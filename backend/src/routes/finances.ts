import { Hono } from "hono";
import { prisma } from "../prisma";

const financesRouter = new Hono();

// GET /api/finances?from=ISO_DATE&to=ISO_DATE
financesRouter.get("/", async (c) => {
  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");

  // Build date filters
  const fromDate = fromParam ? new Date(fromParam) : undefined;
  // Make "to" inclusive by setting to end of day
  let toDate: Date | undefined;
  if (toParam) {
    toDate = new Date(toParam);
    toDate.setHours(23, 59, 59, 999);
  }

  const saleDateFilter =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  const createdAtFilter =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  // --- Sales in period ---
  const salesInPeriod = await prisma.sale.findMany({
    where: saleDateFilter ? { saleDate: saleDateFilter } : {},
    include: {
      vehicle: {
        include: { costs: true },
      },
      customer: true,
    },
    orderBy: { saleDate: "desc" },
  });

  // --- Vehicles purchased (created) in period ---
  const vehiclesBoughtInPeriod = await prisma.vehicle.findMany({
    where: createdAtFilter ? { createdAt: createdAtFilter } : {},
    include: { costs: true },
  });

  // --- Vehicles currently in stock (not sold, regardless of date filter) ---
  const vehiclesInStock = await prisma.vehicle.findMany({
    where: { status: { not: "sold" } },
    select: { purchasePrice: true },
  });

  // --- Compute purchases aggregates ---
  const vehiclesBoughtCount = vehiclesBoughtInPeriod.length;
  const totalPurchaseCost = vehiclesBoughtInPeriod.reduce(
    (sum, v) => sum + v.purchasePrice,
    0
  );
  const totalAdditionalCosts = vehiclesBoughtInPeriod.reduce(
    (sum, v) => sum + v.costs.reduce((cs, c) => cs + c.amount, 0),
    0
  );

  // --- Compute sales aggregates ---
  const vehiclesSoldCount = salesInPeriod.length;
  const totalRevenue = salesInPeriod.reduce((sum, s) => sum + s.salePrice, 0);

  // Per-sale profit calculation
  type SaleRow = {
    id: string;
    saleDate: string;
    vehicleNumber: string;
    brand: string;
    model: string;
    purchasePrice: number;
    additionalCosts: number;
    salePrice: number;
    profit: number;
    customerName: string;
  };

  const saleRows: SaleRow[] = salesInPeriod.map((sale) => {
    const additionalCosts = sale.vehicle.costs.reduce(
      (sum, cost) => sum + cost.amount,
      0
    );
    const profit =
      sale.salePrice - sale.vehicle.purchasePrice - additionalCosts;
    const customerName =
      `${sale.customer.firstName} ${sale.customer.lastName}`.trim();

    return {
      id: sale.id,
      saleDate: sale.saleDate.toISOString(),
      vehicleNumber: sale.vehicle.vehicleNumber,
      brand: sale.vehicle.brand,
      model: sale.vehicle.model,
      purchasePrice: sale.vehicle.purchasePrice,
      additionalCosts,
      salePrice: sale.salePrice,
      profit,
      customerName,
    };
  });

  const totalProfit = saleRows.reduce((sum, s) => sum + s.profit, 0);
  const profitableSales = saleRows.filter((s) => s.profit > 0).length;
  const lossSales = saleRows.filter((s) => s.profit <= 0).length;

  // Best sale (highest profit)
  let bestSale: {
    vehicleNumber: string;
    brand: string;
    model: string;
    profit: number;
  } | null = null;

  if (saleRows.length > 0) {
    const best = saleRows.reduce((prev, curr) =>
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
  const stockValue = vehiclesInStock.reduce(
    (sum, v) => sum + v.purchasePrice,
    0
  );

  return c.json({
    data: {
      vehiclesBought: vehiclesBoughtCount,
      totalPurchaseCost,
      totalAdditionalCosts,
      vehiclesSold: vehiclesSoldCount,
      totalRevenue,
      totalProfit,
      profitableSales,
      lossSales,
      vehiclesInStock: vehiclesInStockCount,
      stockValue,
      bestSale,
      sales: saleRows,
    },
  });
});

export { financesRouter };
