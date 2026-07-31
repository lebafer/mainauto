import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { prisma } from "./prisma";
import { env } from "./env";
import { parseExactTenantOrigin } from "./lib/trustedOrigins";

export function getCookieDomain(
  backendUrl: string,
  configuredDomain?: string
): string | undefined {
  if (configuredDomain && configuredDomain.trim().length > 0) {
    return configuredDomain.startsWith(".") ? configuredDomain : `.${configuredDomain}`;
  }

  const hostname = new URL(backendUrl).hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return undefined;
  }
  if (hostname === "dev.vibecode.run" || hostname.endsWith(".dev.vibecode.run")) {
    return ".dev.vibecode.run";
  }
  return undefined;
}

const cookieDomain = getCookieDomain(env.BACKEND_URL, env.COOKIE_DOMAIN);
const isProduction = env.NODE_ENV === "production";

function staticTrustedOrigins(): string[] {
  const trustedOriginsSet = new Set<string>([
    new URL(env.BACKEND_URL).origin,
    "http://localhost:8000",
    "http://127.0.0.1:8000",
  ]);

  for (const origin of (env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    trustedOriginsSet.add(origin);
  }

  return Array.from(trustedOriginsSet);
}

async function resolveTrustedOrigins(request?: Request): Promise<string[]> {
  const trusted = staticTrustedOrigins();
  const candidate = parseExactTenantOrigin(request?.headers.get("origin"));
  if (!candidate || trusted.includes(candidate.origin)) {
    return trusted;
  }

  const verifiedDomain = await prisma.dealerDomain.findFirst({
    where: {
      host: candidate.host,
      status: "active",
      verifiedAt: { not: null },
    },
    select: { id: true },
  });
  if (verifiedDomain) trusted.push(candidate.origin);
  return trusted;
}

if (isProduction && env.AUTH_DISABLE_CSRF_CHECK) {
  throw new Error("AUTH_DISABLE_CSRF_CHECK must not be enabled in production");
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: env.BACKEND_URL,
  basePath: "/api/auth",
  emailAndPassword: {
    enabled: true,
    // Allow one-time bootstrap via auth API when explicitly requested.
    disableSignUp: !env.BOOTSTRAP_ADMIN,
  },
  trustedOrigins: resolveTrustedOrigins,
  advanced: {
    ...(cookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: cookieDomain,
          },
        }
      : {}),
    defaultCookieAttributes: {
      sameSite: cookieDomain ? "none" : "lax",
      secure: cookieDomain ? true : isProduction,
      httpOnly: true,
    },
    useSecureCookies: isProduction,
    disableCSRFCheck: env.AUTH_DISABLE_CSRF_CHECK,
  },
  trustedProxyHeaders: true,
  plugins: [username()],
});
