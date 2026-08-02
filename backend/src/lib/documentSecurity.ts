export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeTemplateData<T>(value: T, key?: string): T {
  if (typeof value === "string") {
    if (key === "features") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return JSON.stringify(
            parsed.map((item) =>
              typeof item === "string" ? escapeHtml(item) : item
            )
          ) as T;
        }
      } catch {
        // Fall through and escape malformed legacy feature text as plain text.
      }
    }
    return escapeHtml(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => escapeTemplateData(item)) as T;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        escapeTemplateData(entryValue, entryKey),
      ])
    ) as T;
  }
  return value;
}


function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&");
}

export function richTextToDocumentText(value: string | null | undefined): string {
  if (!value) return "";

  const decoded = decodeBasicHtmlEntities(value);
  return decoded
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(?:p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<\s*(?:p|div|li|h[1-6]|tr)\b[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function richTextToDocumentHtml(value: string | null | undefined): string {
  return escapeHtml(richTextToDocumentText(value)).replace(/\n/g, "<br>");
}

export function sanitizeGeneratedHtml(html: string): string {
  const blockedElements =
    /<(script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|video|audio|source)\b[^>]*>[\s\S]*?<\/\1\s*>|<(script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|video|audio|source)\b[^>]*\/?>/gi;
  let sanitized = html.replace(blockedElements, "");
  sanitized = sanitized
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s+src\s*=\s*(["'])(.*?)\1/gi,
      (attribute, _quote: string, value: string) =>
        /^(?:data:image\/|\/)/i.test(value.trim()) ? attribute : ' src=""'
    )
    .replace(/javascript\s*:/gi, "");

  const firstStyleEnd = sanitized.toLowerCase().indexOf("</style>");
  if (firstStyleEnd >= 0) {
    const keepThrough = firstStyleEnd + "</style>".length;
    sanitized =
      sanitized.slice(0, keepThrough) +
      sanitized.slice(keepThrough).replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");
  }
  return sanitized;
}
