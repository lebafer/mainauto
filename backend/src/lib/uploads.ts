export type ValidatedUpload = {
  extension: "pdf" | "jpg" | "png" | "webp" | "html";
  contentType: string;
};

export const STORED_DOCUMENT_TYPES = [
  "general",
  "contract",
  "purchase_contract",
  "handover_protocol",
  "other_legal",
] as const;

export function parseStoredDocumentType(value: unknown) {
  return typeof value === "string" &&
    (STORED_DOCUMENT_TYPES as readonly string[]).includes(value)
    ? (value as (typeof STORED_DOCUMENT_TYPES)[number])
    : "general";
}

export function isRetentionDocumentType(
  value: (typeof STORED_DOCUMENT_TYPES)[number]
) {
  return value !== "general";
}

const signatures = {
  pdf: (bytes: Uint8Array) =>
    bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-",
  jpg: (bytes: Uint8Array) =>
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  png: (bytes: Uint8Array) =>
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value
    ),
  webp: (bytes: Uint8Array) =>
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP",
};

export async function validateUpload(
  file: File,
  options: {
    kind: "image" | "document";
    maxBytes: number;
    allowHtml?: boolean;
  }
): Promise<ValidatedUpload> {
  if (file.size <= 0) throw new UploadValidationError("EMPTY_FILE", "Datei ist leer");
  if (file.size > options.maxBytes) {
    throw new UploadValidationError("FILE_TOO_LARGE", "Datei ist zu groß");
  }

  const bytes = new Uint8Array(await file.arrayBuffer()).subarray(0, 512);
  if (signatures.jpg(bytes)) return { extension: "jpg", contentType: "image/jpeg" };
  if (signatures.png(bytes)) return { extension: "png", contentType: "image/png" };
  if (signatures.webp(bytes)) return { extension: "webp", contentType: "image/webp" };

  if (options.kind === "document" && signatures.pdf(bytes)) {
    return { extension: "pdf", contentType: "application/pdf" };
  }
  if (
    options.kind === "document" &&
    options.allowHtml &&
    file.type.toLowerCase().split(";")[0] === "text/html"
  ) {
    const prefix = new TextDecoder().decode(bytes).trimStart().toLowerCase();
    if (prefix.startsWith("<!doctype html") || prefix.startsWith("<html")) {
      return { extension: "html", contentType: "text/html; charset=utf-8" };
    }
  }

  throw new UploadValidationError(
    "UNSUPPORTED_FILE_TYPE",
    options.kind === "image"
      ? "Nur JPEG-, PNG- und WebP-Bilder sind erlaubt"
      : "Dieser Dokumenttyp wird nicht unterstützt"
  );
}

export class UploadValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}
