import type { Context } from "hono";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimits = new Map<string, RateLimitEntry>();
let rateLimitOperations = 0;

function pruneExpiredRateLimits(now: number) {
  rateLimitOperations += 1;
  if (rateLimitOperations % 100 !== 0 && rateLimits.size < 1_000) return;
  for (const [key, entry] of rateLimits) {
    if (entry.resetAt <= now) rateLimits.delete(key);
  }
}

export function getClientIp(c: Context): string {
  return (
    c.req.header("x-real-ip")?.trim() ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function consumeRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  pruneExpiredRateLimits(now);
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function rateLimitResponse(c: Context, retryAfterSeconds: number) {
  c.header("Retry-After", String(retryAfterSeconds));
  return c.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "Zu viele Anfragen. Bitte später erneut versuchen.",
      },
    },
    429
  );
}

export function __resetRateLimitsForTests() {
  rateLimits.clear();
  rateLimitOperations = 0;
}
