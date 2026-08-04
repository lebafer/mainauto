import { Hono } from "hono";
import { basename, extname, join } from "path";
import { prisma } from "../prisma";
import { getCurrentDealerId } from "../lib/request-context";
import { ensureImageVariant, getImageVariantConfig } from "../lib/imageVariants";

const uploadsRouter = new Hono();
const UPLOADS_DIR = join(import.meta.dir, "../../uploads");
const SAFE_FILE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/;

function fallbackContentType(fileName: string): string {
  switch (extname(fileName).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    case ".html":
      return "text/html; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

uploadsRouter.get("/:fileName", async (c) => {
  const requested = c.req.param("fileName");
  if (
    !SAFE_FILE_NAME.test(requested) ||
    basename(requested) !== requested
  ) {
    return c.json({ error: { code: "NOT_FOUND", message: "Datei nicht gefunden" } }, 404);
  }

  const dealerId = getCurrentDealerId(c);
  const url = `/api/uploads/${requested}`;
  const [image, vehicleDocument, customerDocument, logoSettings] = await Promise.all([
    prisma.vehicleImage.findFirst({
      where: { dealerId, fileName: requested },
      select: { id: true },
    }),
    prisma.vehicleDocument.findFirst({
      where: { dealerId, fileName: requested, softDeletedAt: null },
      select: { id: true, fileType: true },
    }),
    prisma.customerDocument.findFirst({
      where: { dealerId, fileName: requested, softDeletedAt: null },
      select: { id: true, fileType: true },
    }),
    prisma.dealerSettings.findFirst({
      where: { dealerId, logoUrl: url },
      select: { id: true },
    }),
  ]);
  if (!image && !vehicleDocument && !customerDocument && !logoSettings) {
    return c.json({ error: { code: "NOT_FOUND", message: "Datei nicht gefunden" } }, 404);
  }

  const originalFile = Bun.file(join(UPLOADS_DIR, requested));
  if (!(await originalFile.exists())) {
    return c.json({ error: { code: "NOT_FOUND", message: "Datei nicht gefunden" } }, 404);
  }

  const isInlineImage = Boolean(image || logoSettings);
  const variant = image ? getImageVariantConfig(c.req.query("variant")) : null;

  let responseFile = originalFile;
  let responseFileName = requested;
  let contentType = fallbackContentType(requested);
  let cacheControl = "private, no-store";

  if (variant) {
    try {
      const generated = await ensureImageVariant(UPLOADS_DIR, requested, variant);
      responseFile = Bun.file(generated.path);
      responseFileName = `${requested.replace(/\.[^.]+$/, "")}.${variant.name}.webp`;
      contentType = generated.contentType;
      cacheControl = "private, max-age=86400";
    } catch (error) {
      console.warn(`[uploads] image_variant_failed file=${requested} variant=${variant.name}`, error);
    }
  }

  // Never reflect a historic, user-supplied MIME string into a response header.
  // New uploads use server-generated extensions; unknown legacy files download as octet-stream.
  c.header("Content-Type", contentType);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", cacheControl);
  c.header("Content-Security-Policy", "default-src 'none'; sandbox");
  c.header(
    "Content-Disposition",
    `${isInlineImage ? "inline" : "attachment"}; filename="${responseFileName.replaceAll('"', "")}"`
  );
  return c.body(responseFile.stream() as unknown as ReadableStream);
});

export { uploadsRouter };
