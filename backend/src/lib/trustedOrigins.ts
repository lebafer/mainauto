export function parseExactTenantOrigin(
  originHeader: string | null | undefined
): { origin: string; host: string } | null {
  if (!originHeader) return null;

  try {
    const url = new URL(originHeader);
    const isLocal =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((!isLocal && url.protocol !== "https:") || (isLocal && url.protocol !== "http:")) {
      return null;
    }
    if (!isLocal && url.port && url.port !== "443") {
      return null;
    }
    if (url.username || url.password || url.origin !== originHeader.trim()) {
      return null;
    }
    return { origin: url.origin, host: url.hostname.toLowerCase() };
  } catch {
    return null;
  }
}
