export type DocumentPriceLine = {
  label: string;
  amount: number;
};

export type DocumentPriceSummary = {
  net: number;
  tax: number;
  gross: number;
  primaryPrice: number;
  lines: DocumentPriceLine[];
};

type DocumentPriceInput = {
  netPrice: number;
  taxRate: number;
  marginTaxed: boolean;
};

export function getDocumentPriceSummary({
  netPrice,
  taxRate,
  marginTaxed,
}: DocumentPriceInput): DocumentPriceSummary {
  if (marginTaxed) {
    return {
      net: netPrice,
      tax: 0,
      gross: netPrice,
      primaryPrice: netPrice,
      lines: [{ label: "Kaufpreis", amount: netPrice }],
    };
  }

  const tax = netPrice * (taxRate / 100);
  const gross = netPrice + tax;

  return {
    net: netPrice,
    tax,
    gross,
    primaryPrice: gross,
    lines: [
      { label: "Netto", amount: netPrice },
      { label: `MwSt. (${taxRate}%)`, amount: tax },
      { label: "Brutto", amount: gross },
    ],
  };
}
