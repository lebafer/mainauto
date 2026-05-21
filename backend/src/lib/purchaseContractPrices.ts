export type PurchaseContractPriceLine = {
  label: string;
  amount: number;
};

export type PurchaseContractPriceSummary = {
  primaryPrice: number;
  net: number;
  tax: number;
  gross: number;
  lines: PurchaseContractPriceLine[];
};

export function getPurchaseContractPriceSummary({
  netPurchasePrice,
  taxRate,
  marginTaxed,
}: {
  netPurchasePrice: number;
  taxRate: number;
  marginTaxed: boolean;
}): PurchaseContractPriceSummary {
  if (marginTaxed) {
    return {
      primaryPrice: netPurchasePrice,
      net: netPurchasePrice,
      tax: 0,
      gross: netPurchasePrice,
      lines: [],
    };
  }

  const tax = netPurchasePrice * (taxRate / 100);
  const gross = netPurchasePrice + tax;

  return {
    primaryPrice: gross,
    net: netPurchasePrice,
    tax,
    gross,
    lines: [
      { label: "Netto", amount: netPurchasePrice },
      { label: `MwSt. (${taxRate}%)`, amount: tax },
      { label: "Brutto", amount: gross },
    ],
  };
}
