import { describe, expect, test } from "bun:test";
import { getImageVariantConfig, getImageVariantFileName, buildImageVariantUrl } from "./imageVariants";

describe("image variant helpers", () => {
  test("maps the website variant to a compressed WebP derivative", () => {
    expect(getImageVariantConfig("web")).toEqual({ name: "web", maxLongEdge: 1600, quality: 78 });
    expect(getImageVariantFileName("abc.DEF.jpg", "web")).toBe("abc.DEF.web.webp");
  });

  test("ignores unknown variants so original uploads stay accessible", () => {
    expect(getImageVariantConfig(null)).toBe(null);
    expect(getImageVariantConfig("original")).toBe(null);
  });

  test("adds the website variant query to upload urls", () => {
    expect(buildImageVariantUrl("/api/uploads/photo.jpg", "web")).toBe("/api/uploads/photo.jpg?variant=web");
    expect(buildImageVariantUrl("", "web")).toBe("");
  });
});
