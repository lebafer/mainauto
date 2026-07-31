import { describe, expect, test } from "bun:test";

import {
  calculateGrossPrice,
  calculateNetPrice,
  formatDateOnly,
  getResolvedSaleAmounts,
  parseTaxRateInput,
  richTextToPlainText,
  toDateInputValue,
} from "./vehicles";

describe("vehicle price semantics", () => {
  test("converts the stored regular-tax net price to the gross sale default", () => {
    expect(calculateGrossPrice(10_000, 19, false)).toBe(11_900);
  });

  test("keeps the final price unchanged for margin-taxed vehicles", () => {
    expect(calculateGrossPrice(11_900, 19, true)).toBe(11_900);
  });

  test("derives the regular-tax net amount from a gross sale price", () => {
    expect(calculateNetPrice(11_900, 19, false)).toBe(10_000);
  });

  test("preserves a valid zero-percent tax rate", () => {
    expect(parseTaxRateInput("0")).toBe(0);
  });
});

describe("sale accounting visibility", () => {
  test("does not expose unresolved legacy amounts", () => {
    expect(
      getResolvedSaleAmounts({
        accountingStatus: "legacy_ambiguous",
        grossSalePrice: 11_900,
        netSalePrice: 10_000,
      })
    ).toBe(null);
  });

  test("returns verified gross and net amounts", () => {
    expect(
      getResolvedSaleAmounts({
        accountingStatus: "verified",
        grossSalePrice: 11_900,
        netSalePrice: 10_000,
      })
    ).toEqual({ gross: 11_900, net: 10_000 });
  });
});

describe("date-only vehicle fields", () => {
  test("keeps the calendar day from a backend ISO timestamp", () => {
    expect(toDateInputValue("2024-03-31T00:00:00.000Z")).toBe("2024-03-31");
  });

  test("formats registration dates without UTC day shifts", () => {
    expect(formatDateOnly("2024-03-31T00:00:00.000Z")).toBe("31.03.2024");
  });

  test("returns an empty input value for missing or invalid dates", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue("kein-datum")).toBe("");
  });
});

describe("rich text display", () => {
  test("removes markup instead of rendering executable HTML", () => {
    const input = '<p>Unfallfrei</p><img src=x onerror="alert(1)"><script>alert(2)</script>';
    const output = richTextToPlainText(input);

    expect(output).not.toContain("<");
    expect(output).not.toContain("onerror");
    expect(output).not.toContain("script");
    expect(output).toContain("Unfallfrei");
  });
});
