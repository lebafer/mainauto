import { describe, expect, test } from "bun:test";

import { getPurchaseContractPriceSummary } from "./purchaseContractPrices";

describe("getPurchaseContractPriceSummary", () => {
  test("uses the gross purchase price as the primary price for regularly taxed purchases", () => {
    const summary = getPurchaseContractPriceSummary({
      netPurchasePrice: 10000,
      taxRate: 19,
      marginTaxed: false,
    });

    expect(summary.primaryPrice).toBe(11900);
    expect(summary.net).toBe(10000);
    expect(summary.tax).toBe(1900);
    expect(summary.gross).toBe(11900);
    expect(summary.lines).toEqual([
      { label: "Netto", amount: 10000 },
      { label: "MwSt. (19%)", amount: 1900 },
      { label: "Brutto", amount: 11900 },
    ]);
  });

  test("keeps margin taxed purchase prices as one non-tax-disclosing end price", () => {
    const summary = getPurchaseContractPriceSummary({
      netPurchasePrice: 10000,
      taxRate: 19,
      marginTaxed: true,
    });

    expect(summary.primaryPrice).toBe(10000);
    expect(summary.net).toBe(10000);
    expect(summary.tax).toBe(0);
    expect(summary.gross).toBe(10000);
    expect(summary.lines).toEqual([]);
  });
});
