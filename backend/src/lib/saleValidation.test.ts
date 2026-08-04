import { describe, expect, test } from "bun:test";
import { SaleUpdateSchema } from "../types";

describe("SaleUpdateSchema", () => {
  test("accepts editing sale date, customer, price mode, amount and notes", () => {
    const parsed = SaleUpdateSchema.parse({
      customerId: "customer-1",
      salePrice: 20_000,
      priceMode: "net",
      taxRate: 19,
      saleDate: "2026-08-04",
      notes: "Datum korrigiert",
    });

    expect(parsed.customerId).toBe("customer-1");
    expect(parsed.priceMode).toBe("net");
    expect(parsed.saleDate).toBe("2026-08-04");
  });

  test("rejects an empty update payload", () => {
    expect(() => SaleUpdateSchema.parse({})).toThrow();
  });
});
