import { describe, expect, test } from "bun:test";

import { getResizedImageDimensions, shouldDownscaleImage } from "./imageCompression";

describe("vehicle image compression sizing", () => {
  test("keeps the original dimensions when the image is already within the long-edge limit", () => {
    expect(getResizedImageDimensions(1280, 960, 1920)).toEqual({ width: 1280, height: 960 });
  });

  test("scales landscape images down to the long-edge limit", () => {
    expect(getResizedImageDimensions(4032, 3024, 1920)).toEqual({ width: 1920, height: 1440 });
  });

  test("scales portrait images down to the long-edge limit", () => {
    expect(getResizedImageDimensions(3024, 4032, 1920)).toEqual({ width: 1440, height: 1920 });
  });

  test("downscales big normal photos but leaves small images alone", () => {
    expect(shouldDownscaleImage({ width: 4032, height: 3024, fileSize: 6_000_000 })).toBe(true);
    expect(shouldDownscaleImage({ width: 1280, height: 960, fileSize: 400_000 })).toBe(false);
  });
});
