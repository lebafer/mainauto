import { describe, expect, test } from "bun:test";
import { buildBillingReturnUrl } from "./billingUrls";

describe("buildBillingReturnUrl", () => {
  test("keeps the checkout marker when the frontend supplies /billing", () => {
    expect(
      buildBillingReturnUrl(
        "https://carops.de",
        "/billing",
        "/billing",
        "success"
      )
    ).toBe("https://carops.de/billing?checkout=success");
  });

  test("preserves safe query parameters and overwrites only the checkout marker", () => {
    expect(
      buildBillingReturnUrl(
        "https://carops.de",
        "/billing?tab=plan&checkout=old",
        "/billing",
        "cancelled"
      )
    ).toBe("https://carops.de/billing?tab=plan&checkout=cancelled");
  });

  test("rejects protocol-relative return paths", () => {
    expect(
      buildBillingReturnUrl(
        "https://carops.de",
        "//attacker.invalid",
        "/billing",
        "success"
      )
    ).toBe("https://carops.de/billing?checkout=success");
  });
});
