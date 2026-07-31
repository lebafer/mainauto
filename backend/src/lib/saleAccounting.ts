import {
  MAX_INTEGER_CENTS,
  MoneyOverflowError,
  calculateMarginTaxCents,
  grossToTaxedMoney,
  netToTaxedMoney,
  toCents,
} from "./money";

type SaleVehicleAccountingInput = {
  marginTaxed: boolean;
  purchasePrice: number;
  exportEnabled?: boolean | null;
  transportCostDomestic?: number | null;
  transportCostAbroad?: number | null;
  customsDuties?: number | null;
  registrationFees?: number | null;
  repairCostsAbroad?: number | null;
  costs: Array<{ amount: number }>;
};

function optionalMoneyCents(value: number | null | undefined): number {
  return toCents(typeof value === "number" && Number.isFinite(value) ? value : 0);
}

export function buildSaleAccountingSnapshot(
  grossAmount: number,
  taxRate: number,
  vehicle: SaleVehicleAccountingInput
) {
  const amounts = grossToTaxedMoney(grossAmount, taxRate, vehicle.marginTaxed);
  const purchasePriceCents = optionalMoneyCents(vehicle.purchasePrice);
  const marginTaxCents = vehicle.marginTaxed
    ? calculateMarginTaxCents(amounts.grossCents, purchasePriceCents, taxRate)
    : 0;
  const manualCostsCents = vehicle.costs.reduce(
    (sum, cost) => sum + optionalMoneyCents(cost.amount),
    0
  );
  const exportCostsCents =
    optionalMoneyCents(vehicle.transportCostDomestic) +
    (vehicle.exportEnabled
      ? optionalMoneyCents(vehicle.transportCostAbroad) +
        optionalMoneyCents(vehicle.customsDuties) +
        optionalMoneyCents(vehicle.registrationFees) +
        optionalMoneyCents(vehicle.repairCostsAbroad)
      : 0);
  const totalCostCents = purchasePriceCents + manualCostsCents + exportCostsCents;
  if (
    !Number.isSafeInteger(manualCostsCents) ||
    !Number.isSafeInteger(exportCostsCents) ||
    !Number.isSafeInteger(totalCostCents) ||
    manualCostsCents > MAX_INTEGER_CENTS ||
    exportCostsCents > MAX_INTEGER_CENTS ||
    totalCostCents > MAX_INTEGER_CENTS
  ) {
    throw new MoneyOverflowError("Sale cost snapshot exceeds the supported database range");
  }

  return {
    accountingStatus: "verified" as const,
    priceModeSnapshot: "gross" as const,
    marginTaxedSnapshot: vehicle.marginTaxed,
    grossCents: amounts.grossCents,
    netCents: amounts.grossCents - amounts.taxCents - marginTaxCents,
    taxCents: amounts.taxCents,
    marginTaxCents,
    purchasePriceCents,
    manualCostsCents,
    exportCostsCents,
    totalCostCents,
  };
}

export function resolveLegacySaleAccounting(input: {
  storedPrice: number;
  taxRate: number;
  historicTaxMode: "regular" | "margin";
  historicPriceMode?: "gross" | "net";
  purchasePriceCents: number;
  manualCostsCents: number;
  exportCostsCents: number;
}) {
  const amounts =
    input.historicTaxMode === "margin"
      ? grossToTaxedMoney(input.storedPrice, input.taxRate, true)
      : input.historicPriceMode === "net"
        ? netToTaxedMoney(input.storedPrice, input.taxRate, false)
        : grossToTaxedMoney(input.storedPrice, input.taxRate, false);
  const marginTaxCents =
    input.historicTaxMode === "margin"
      ? calculateMarginTaxCents(
          amounts.grossCents,
          input.purchasePriceCents,
          input.taxRate
        )
      : 0;
  const totalCostCents =
    input.purchasePriceCents +
    input.manualCostsCents +
    input.exportCostsCents;
  if (
    !Number.isSafeInteger(totalCostCents) ||
    totalCostCents > MAX_INTEGER_CENTS
  ) {
    throw new MoneyOverflowError();
  }

  return {
    accountingStatus: "verified" as const,
    priceModeSnapshot:
      input.historicTaxMode === "margin"
        ? ("gross" as const)
        : (input.historicPriceMode as "gross" | "net"),
    marginTaxedSnapshot: input.historicTaxMode === "margin",
    grossCents: amounts.grossCents,
    netCents: amounts.grossCents - amounts.taxCents - marginTaxCents,
    taxCents: amounts.taxCents,
    marginTaxCents,
    purchasePriceCents: input.purchasePriceCents,
    manualCostsCents: input.manualCostsCents,
    exportCostsCents: input.exportCostsCents,
    totalCostCents,
  };
}
