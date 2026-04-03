import { createHash, randomBytes } from "crypto";
import { env } from "../env";

const WEBSITE_FEED_TOKEN_PREFIX = "vwf";
const WEBSITE_FEED_PATH = "/api/public/website-feed/vehicles";

export function getWebsiteFeedUrl(): string {
  return new URL(WEBSITE_FEED_PATH, env.BACKEND_URL).toString();
}

export function createWebsiteFeedToken(): {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
  tokenLast4: string;
  tokenPreview: string;
} {
  const secret = randomBytes(32).toString("base64url");
  const rawToken = `${WEBSITE_FEED_TOKEN_PREFIX}_${secret}`;
  const tokenHash = hashWebsiteFeedToken(rawToken);
  const tokenPrefix = rawToken.slice(0, 12);
  const tokenLast4 = rawToken.slice(-4);

  return {
    rawToken,
    tokenHash,
    tokenPrefix,
    tokenLast4,
    tokenPreview: formatWebsiteFeedTokenPreview(tokenPrefix, tokenLast4),
  };
}

export function hashWebsiteFeedToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function formatWebsiteFeedTokenPreview(prefix: string, last4: string): string {
  return `${prefix}...${last4}`;
}

export function toAbsoluteAssetUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, env.BACKEND_URL).toString();
  } catch {
    return null;
  }
}

export function parseVehicleFeatures(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean);
    }
  } catch {
    // Fall through to plain-text parsing.
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
