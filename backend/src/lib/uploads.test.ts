import { describe, expect, test } from "bun:test";
import {
  UploadValidationError,
  isRetentionDocumentType,
  parseStoredDocumentType,
  validateUpload,
} from "./uploads";

describe("validateUpload", () => {
  test("uses file signatures instead of a spoofable mime type", async () => {
    const png = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "payload.html",
      { type: "text/html" }
    );
    expect(await validateUpload(png, { kind: "image", maxBytes: 1024 })).toEqual({
      extension: "png",
      contentType: "image/png",
    });
  });

  test("rejects svg/script content presented as an image", async () => {
    const svg = new File(["<svg onload=alert(1)>"], "logo.svg", {
      type: "image/svg+xml",
    });
    await expect(validateUpload(svg, { kind: "image", maxBytes: 1024 })).rejects.toBeInstanceOf(
      UploadValidationError
    );
  });

  test("marks only explicit legal document types for retention", () => {
    expect(parseStoredDocumentType("contract")).toBe("contract");
    expect(isRetentionDocumentType("contract")).toBe(true);
    expect(parseStoredDocumentType("unknown")).toBe("general");
    expect(isRetentionDocumentType("general")).toBe(false);
  });
});
