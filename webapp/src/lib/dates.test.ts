import { describe, expect, test } from "bun:test";

import { toLocalDateInputValue } from "./dates";

describe("local date inputs", () => {
  test("uses the local calendar day instead of the UTC day", () => {
    const shortlyAfterLocalMidnight = new Date(2026, 6, 27, 0, 30);

    expect(toLocalDateInputValue(shortlyAfterLocalMidnight)).toBe("2026-07-27");
  });

  test("pads month and day", () => {
    expect(toLocalDateInputValue(new Date(2026, 0, 2, 12))).toBe("2026-01-02");
  });
});
