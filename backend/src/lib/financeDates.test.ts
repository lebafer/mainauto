import { describe, expect, test } from "bun:test";
import { getBerlinDateRange } from "./financeDates";

describe("Berlin finance date ranges", () => {
  test("uses CET boundaries in winter and CEST boundaries in summer", () => {
    expect(
      getBerlinDateRange({ from: "2026-01-15" }).fromDate?.toISOString()
    ).toBe("2026-01-14T23:00:00.000Z");
    expect(
      getBerlinDateRange({ from: "2026-07-15" }).fromDate?.toISOString()
    ).toBe("2026-07-14T22:00:00.000Z");
  });

  test("creates a 23-hour half-open range across the spring DST change", () => {
    const range = getBerlinDateRange({
      from: "2026-03-29",
      to: "2026-03-29",
    });
    expect(range.fromDate?.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(range.toDateExclusive?.toISOString()).toBe(
      "2026-03-29T22:00:00.000Z"
    );
  });

  test("creates a 25-hour half-open range across the autumn DST change", () => {
    const range = getBerlinDateRange({
      from: "2026-10-25",
      to: "2026-10-25",
    });
    expect(range.fromDate?.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(range.toDateExclusive?.toISOString()).toBe(
      "2026-10-25T23:00:00.000Z"
    );
  });
});
