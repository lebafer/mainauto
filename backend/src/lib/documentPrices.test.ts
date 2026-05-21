import { describe, expect, test } from "bun:test";

import { getDocumentPriceSummary } from "./documentPrices";

describe("getDocumentPriceSummary", () => {
  test("shows gross, VAT amount and net price for regularly taxed vehicle contracts", () => {
    const summary = getDocumentPriceSummary({
      netPrice: 10000,
      taxRate: 19,
      marginTaxed: false,
    });

    expect(summary.gross).toBe(11900);
    expect(summary.tax).toBe(1900);
    expect(summary.net).toBe(10000);
    expect(summary.primaryPrice).toBe(11900);
    expect(summary.lines).toEqual([
      { label: "Netto", amount: 10000 },
      { label: "MwSt. (19%)", amount: 1900 },
      { label: "Brutto", amount: 11900 },
    ]);
  });

  test("keeps margin-taxed vehicle contracts as a single non-tax-disclosing price", () => {
    const summary = getDocumentPriceSummary({
      netPrice: 10000,
      taxRate: 19,
      marginTaxed: true,
    });

    expect(summary.gross).toBe(10000);
    expect(summary.tax).toBe(0);
    expect(summary.net).toBe(10000);
    expect(summary.primaryPrice).toBe(10000);
    expect(summary.lines).toEqual([{ label: "Kaufpreis", amount: 10000 }]);
  });
});
