import { describe, expect, test } from "bun:test";
import {
  buildCancellationArtifact,
  hashHtmlArtifact,
} from "./invoiceArtifacts";

describe("invoice cancellation artifact", () => {
  test("keeps the original immutable and creates a separately hashed STORNIERT copy", () => {
    const original =
      "<!doctype html><html><body><h1>Rechnung RE-1</h1></body></html>";
    const unchanged = original;
    const canceled = buildCancellationArtifact({
      originalHtml: original,
      canceledAt: new Date("2026-07-27T12:00:00.000Z"),
      reason: `Verkauf <img onerror="alert(1)"> storniert`,
    });
    expect(original).toBe(unchanged);
    expect(canceled).toContain("STORNIERT");
    expect(canceled).not.toContain("<img");
    expect(hashHtmlArtifact(canceled)).not.toBe(hashHtmlArtifact(original));
  });

  test("uses the Berlin cancellation date around UTC midnight", () => {
    const canceled = buildCancellationArtifact({
      originalHtml: "<html><body>Rechnung</body></html>",
      canceledAt: new Date("2025-12-31T23:30:00.000Z"),
      reason: "Kaufvertrag rückabgewickelt",
    });

    expect(canceled).toContain("01.01.2026");
  });
});
