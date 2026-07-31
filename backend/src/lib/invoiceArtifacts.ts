import { createHash } from "node:crypto";
import { escapeHtml, sanitizeGeneratedHtml } from "./documentSecurity";
import { formatBusinessDate } from "./businessDates";

export function hashHtmlArtifact(html: string): string {
  return createHash("sha256").update(html, "utf8").digest("hex");
}

export function buildCancellationArtifact(input: {
  originalHtml: string;
  canceledAt: Date;
  reason: string;
}): string {
  const banner = `
    <aside style="border:4px solid #b91c1c;color:#b91c1c;font:800 28px Arial,sans-serif;padding:10px 16px;text-align:center;margin:0 0 24px">
      STORNIERT
      <div style="font-size:11px;font-weight:400;margin-top:6px">
        ${escapeHtml(formatBusinessDate(input.canceledAt))} ·
        ${escapeHtml(input.reason)}
      </div>
    </aside>`;
  const withBanner = /<body\b[^>]*>/i.test(input.originalHtml)
    ? input.originalHtml.replace(
        /<body\b[^>]*>/i,
        (bodyTag) => `${bodyTag}${banner}`
      )
    : `${banner}${input.originalHtml}`;
  return sanitizeGeneratedHtml(withBanner);
}
