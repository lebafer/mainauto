import { mkdir } from "fs/promises";
import { basename, extname, join } from "path";
import sharp from "sharp";

export type ImageVariantName = "web";

export type ImageVariantConfig = {
  name: ImageVariantName;
  maxLongEdge: number;
  quality: number;
};

const VARIANTS: Record<ImageVariantName, ImageVariantConfig> = {
  web: { name: "web", maxLongEdge: 1600, quality: 78 },
};

export function getImageVariantConfig(value: string | null | undefined): ImageVariantConfig | null {
  return value === "web" ? VARIANTS.web : null;
}

export function getImageVariantFileName(fileName: string, variant: ImageVariantName): string {
  const extension = extname(fileName);
  const base = basename(fileName, extension);
  return `${base}.${variant}.webp`;
}

export function buildImageVariantUrl(url: string, variant: ImageVariantName): string {
  if (!url) return url;
  return `${url}${url.includes("?") ? "&" : "?"}variant=${variant}`;
}

export async function ensureImageVariant(
  uploadsDir: string,
  fileName: string,
  variant: ImageVariantConfig
): Promise<{ path: string; contentType: "image/webp" }> {
  const variantsDir = join(uploadsDir, "variants");
  await mkdir(variantsDir, { recursive: true });

  const variantFileName = getImageVariantFileName(fileName, variant.name);
  const variantPath = join(variantsDir, variantFileName);
  const existing = Bun.file(variantPath);
  if (await existing.exists()) {
    return { path: variantPath, contentType: "image/webp" };
  }

  const sourcePath = join(uploadsDir, fileName);
  await sharp(sourcePath, { failOn: "none" })
    .rotate()
    .resize({
      width: variant.maxLongEdge,
      height: variant.maxLongEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: variant.quality, effort: 4 })
    .toFile(variantPath);

  return { path: variantPath, contentType: "image/webp" };
}
