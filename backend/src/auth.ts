import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username, bearer } from "better-auth/plugins";
import { prisma } from "./prisma";
import { env } from "./env";

function getCookieDomain(configuredDomain?: string): string | undefined {
  if (configuredDomain && configuredDomain.trim().length > 0) {
    return configuredDomain.startsWith(".") ? configuredDomain : `.${configuredDomain}`;
  }
  return undefined;
}

const cookieDomain = getCookieDomain(env.COOKIE_DOMAIN);
const isProduction = env.NODE_ENV === "production";

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

const trustedOrigins = Array.from(trustedOriginsSet);

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
  trustedOrigins,
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
      secure: isProduction,
      httpOnly: true,
    },
    useSecureCookies: isProduction,
  },
  trustedProxyHeaders: true,
  plugins: [username(), bearer()],
});
