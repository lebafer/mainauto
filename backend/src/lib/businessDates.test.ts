import { describe, expect, test } from "bun:test";

import {
  formatBusinessDate,
  getBusinessCalendarYear,
} from "./businessDates";

describe("Berlin business dates", () => {
  test("uses the new Berlin calendar year shortly after local New Year", () => {
    const shortlyAfterBerlinNewYear = new Date("2025-12-31T23:30:00.000Z");

    expect(formatBusinessDate(shortlyAfterBerlinNewYear)).toBe("01.01.2026");
    expect(getBusinessCalendarYear(shortlyAfterBerlinNewYear)).toBe(2026);
  });

  test("uses the Berlin summer calendar day shortly after local midnight", () => {
    const shortlyAfterBerlinSummerMidnight = new Date(
      "2026-07-26T22:30:00.000Z"
    );

    expect(formatBusinessDate(shortlyAfterBerlinSummerMidnight)).toBe(
      "27.07.2026"
    );
  });
});
