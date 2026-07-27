import { describe, expect, test } from "bun:test";
import { escapeTemplateData, sanitizeGeneratedHtml } from "./documentSecurity";

describe("sanitizeGeneratedHtml", () => {
  test("removes active content and remote resource loads", () => {
    const html = sanitizeGeneratedHtml(`
      <html><head><style>body { color: black }</style></head><body>
        <script>alert(1)</script>
        <img src="http://127.0.0.1/private" onerror="alert(1)">
        <a href="javascript:alert(1)">click</a>
        <style>body { background: url(https://attacker.invalid) }</style>
      </body></html>
    `);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("127.0.0.1");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("attacker.invalid");
    expect(html).toContain("body { color: black }");
  });

  test("escapes database and form text before it reaches a template", () => {
    const escaped = escapeTemplateData({
      name: `</div><form action="/api"><img src=x onerror=alert(1)>`,
      features: JSON.stringify([`</style><style>body{background:url(https://evil.invalid)}</style>`]),
    });
    expect(escaped.name).not.toContain("<form");
    expect(escaped.name).not.toContain("<img");
    expect(JSON.parse(escaped.features)[0]).not.toContain("<style>");
    expect(escaped.name).toContain("&lt;form");
  });
});
