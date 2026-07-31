export type TaxedMoney = {
  grossCents: number;
  netCents: number;
  taxCents: number;
};

export const MAX_INTEGER_CENTS = 2_147_483_647;
export const MAX_MONEY_AMOUNT = 20_000_000;

export class MoneyOverflowError extends Error {
  constructor(message = "Money value exceeds the supported database range") {
    super(message);
  }
}

export function toCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Money value must be finite");
  }
  const cents = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_INTEGER_CENTS) {
    throw new MoneyOverflowError();
  }
  return cents;
}

export function fromCents(value: number): number {
  return value / 100;
}

export function grossToTaxedMoney(
  grossAmount: number,
  taxRate: number,
  marginTaxed: boolean
): TaxedMoney {
  const grossCents = toCents(grossAmount);
  if (marginTaxed || taxRate <= 0) {
    return { grossCents, netCents: grossCents, taxCents: 0 };
  }

  const rateBasisPoints = Math.round(taxRate * 100);
  const netCents = Math.round((grossCents * 10_000) / (10_000 + rateBasisPoints));
  return {
    grossCents,
    netCents,
    taxCents: grossCents - netCents,
  };
}

export function netToTaxedMoney(
  netAmount: number,
  taxRate: number,
  marginTaxed: boolean
): TaxedMoney {
  const netCents = toCents(netAmount);
  if (marginTaxed || taxRate <= 0) {
    return { grossCents: netCents, netCents, taxCents: 0 };
  }

  const taxCents = Math.round((netCents * Math.round(taxRate * 100)) / 10_000);
  return {
    grossCents: netCents + taxCents,
    netCents,
    taxCents,
  };
}

export function calculateMarginTaxCents(
  grossCents: number,
  purchasePriceCents: number,
  taxRate: number
): number {
  const positiveMarginCents = Math.max(0, grossCents - purchasePriceCents);
  if (positiveMarginCents === 0 || taxRate <= 0) return 0;

  const rateBasisPoints = Math.round(taxRate * 100);
  const marginTaxCents = Math.round(
    (positiveMarginCents * rateBasisPoints) / (10_000 + rateBasisPoints)
  );
  if (
    !Number.isSafeInteger(marginTaxCents) ||
    marginTaxCents > MAX_INTEGER_CENTS
  ) {
    throw new MoneyOverflowError();
  }
  return marginTaxCents;
}
