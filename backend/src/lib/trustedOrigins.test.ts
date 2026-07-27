import { describe, expect, test } from "bun:test";
import { parseExactTenantOrigin } from "./trustedOrigins";

describe("parseExactTenantOrigin", () => {
  test("accepts an exact HTTPS custom origin", () => {
    expect(parseExactTenantOrigin("https://dealer.example")).toEqual({
      origin: "https://dealer.example",
      host: "dealer.example",
    });
  });

  test("rejects reflection-prone URLs and insecure remote origins", () => {
    expect(parseExactTenantOrigin("https://dealer.example/path")).toBeNull();
    expect(parseExactTenantOrigin("https://dealer.example@attacker.invalid")).toBeNull();
    expect(parseExactTenantOrigin("http://dealer.example")).toBeNull();
    expect(parseExactTenantOrigin("https://dealer.example:8443")).toBeNull();
  });
});
