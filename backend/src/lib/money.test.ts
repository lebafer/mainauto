import { describe, expect, test } from "bun:test";
import {
  MoneyOverflowError,
  fromCents,
  grossToTaxedMoney,
  netToTaxedMoney,
  toCents,
} from "./money";

describe("money", () => {
  test("rounds decimal input to cents", () => {
    expect(toCents(10.005)).toBe(1001);
    expect(fromCents(1001)).toBe(10.01);
  });

  test("splits a gross regular-taxed sale without floating point drift", () => {
    expect(grossToTaxedMoney(119, 19, false)).toEqual({
      grossCents: 11900,
      netCents: 10000,
      taxCents: 1900,
    });
  });

  test("does not disclose tax for margin-taxed sales", () => {
    expect(grossToTaxedMoney(119, 19, true)).toEqual({
      grossCents: 11900,
      netCents: 11900,
      taxCents: 0,
    });
  });

  test("builds a gross amount from a net catalog price", () => {
    expect(netToTaxedMoney(100, 19, false)).toEqual({
      grossCents: 11900,
      netCents: 10000,
      taxCents: 1900,
    });
  });

  test("rejects values that cannot fit into a PostgreSQL integer cents column", () => {
    expect(() => toCents(21_474_836.48)).toThrow(MoneyOverflowError);
  });
});
