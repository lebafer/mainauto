import { beforeEach, describe, expect, test } from "bun:test";
import { __resetRateLimitsForTests, consumeRateLimit } from "./security";

describe("consumeRateLimit", () => {
  beforeEach(__resetRateLimitsForTests);

  test("blocks after the configured amount and resets with the window", () => {
    expect(consumeRateLimit("signup:1", { limit: 2, windowMs: 1000 }, 0).allowed).toBe(true);
    expect(consumeRateLimit("signup:1", { limit: 2, windowMs: 1000 }, 1).allowed).toBe(true);
    expect(consumeRateLimit("signup:1", { limit: 2, windowMs: 1000 }, 2).allowed).toBe(false);
    expect(consumeRateLimit("signup:1", { limit: 2, windowMs: 1000 }, 1000).allowed).toBe(true);
  });
});
