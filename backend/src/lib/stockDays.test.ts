import { describe, expect, test } from "bun:test";
import { calculateStockDays } from "./stockDays";

describe("calculateStockDays", () => {
  test("counts full calendar days from purchase to reference date", () => {
    expect(calculateStockDays("2026-08-01", "2026-08-04")).toBe(3);
  });

  test("uses the sale date as the end date for sold vehicles", () => {
    expect(calculateStockDays("2026-07-20", "2026-08-04T12:00:00.000Z")).toBe(15);
  });

  test("does not return negative days for future or same-day dates", () => {
    expect(calculateStockDays("2026-08-04", "2026-08-04")).toBe(0);
    expect(calculateStockDays("2026-08-05", "2026-08-04")).toBe(0);
  });
});
