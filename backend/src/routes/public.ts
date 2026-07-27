import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import {
  DEFAULT_DEALER_SETTINGS,
  DEFAULT_PLATFORM_NAME,
  DEFAULT_PLATFORM_SLOGAN,
  DEFAULT_SUPPORT_EMAIL,
  slugifyDealerName,
  normalizeHost,
} from "../lib/dealers";
import { addTrialDays, TRIAL_DAYS } from "../lib/billing";
import { PublicSignupSchema } from "../types";
import { env } from "../env";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "../lib/security";
import { basename, extname, join } from "path";

const publicRouter = new Hono();
const UPLOADS_DIR = join(import.meta.dir, "../../uploads");

async function resolvePublicDealerDomain(hostHeader: string | undefined) {
  const host = normalizeHost(hostHeader);
  if (!host) return null;
  return prisma.dealerDomain.findFirst({
    where: { host, status: "active", verifiedAt: { not: null } },
    include: { dealer: { include: { settings: true } } },
  });
}

function isPlatformHost(host: string): boolean {
  const backendHost = normalizeHost(new URL(env.BACKEND_URL).hostname);
  const platformHost = normalizeHost(env.PLATFORM_DOMAIN);
  return (
    !host ||
    host === backendHost ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === platformHost
  );
}

async function resolvePublicTenant(hostHeader: string | undefined) {
  const host = normalizeHost(hostHeader);
  const domain = await resolvePublicDealerDomain(host);
  if (domain) {
    return { dealer: domain.dealer, domain };
  }
  if (!isPlatformHost(host)) {
    return null;
  }

  const dealer = await prisma.dealer.findFirst({
    where: {
      isDefault: true,
      status: "active",
    },
    include: { settings: true },
    orderBy: { createdAt: "asc" },
  });
  return dealer ? { dealer, domain: null } : { dealer: null, domain: null };
}

async function createUniqueDealerSlug(companyName: string) {
  const base = slugifyDealerName(companyName);

  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await prisma.dealer.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

publicRouter.get("/plans", async (c) => {
  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
      slug: { in: ["standard", "pro"] },
    },
    orderBy: { monthlyPriceCents: "asc" },
  });

  return c.json({
    data: plans.map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      monthlyPriceCents: plan.monthlyPriceCents,
      trialDays: TRIAL_DAYS,
      featureEntitlements: plan.featureEntitlements,
      stripeConfigured: Boolean(plan.stripePriceMonthlyId),
    })),
  });
});

publicRouter.get("/tenant-context", async (c) => {
  const host = normalizeHost(c.req.header("host"));
  const tenant = await resolvePublicTenant(host);
  if (!tenant) {
    return c.json(
      { error: { code: "UNKNOWN_TENANT", message: "Mandant nicht gefunden" } },
      404
    );
  }
  if (tenant.dealer) {
    const { dealer, domain } = tenant;
    const settings = dealer.settings;
    return c.json({
      data: {
        displayName: settings?.displayName || settings?.legalName || dealer.name,
        logoUrl: settings?.logoUrl
          ? `/api/public/branding/${basename(settings.logoUrl)}`
          : null,
        faviconUrl: settings?.faviconUrl
          ? `/api/public/branding/${basename(settings.faviconUrl)}`
          : null,
        primaryColor: settings?.primaryColor ?? null,
        accentColor: settings?.accentColor ?? null,
        loginHeadline: settings?.loginHeadline ?? null,
        supportEmail: settings?.supportEmail ?? settings?.email ?? null,
        tenantStatus: dealer.status === "active" ? dealer.setupStatus : dealer.status,
        dealer: {
          id: dealer.id,
          name: dealer.name,
          slug: dealer.slug,
          status: dealer.status,
          setupStatus: dealer.setupStatus,
          isDefault: dealer.isDefault,
          createdAt: dealer.createdAt.toISOString(),
          updatedAt: dealer.updatedAt.toISOString(),
        },
        activeDomain: domain
          ? {
              id: domain.id,
              dealerId: domain.dealerId,
              host: domain.host,
              status: domain.status,
              isPrimary: domain.isPrimary,
              verifiedAt: domain.verifiedAt?.toISOString() ?? null,
              createdAt: domain.createdAt.toISOString(),
              updatedAt: domain.updatedAt.toISOString(),
            }
          : null,
      },
    });
  }

  return c.json({
    data: {
      displayName: DEFAULT_PLATFORM_NAME,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: DEFAULT_DEALER_SETTINGS.primaryColor,
      accentColor: DEFAULT_DEALER_SETTINGS.accentColor,
      loginHeadline: DEFAULT_PLATFORM_SLOGAN,
      supportEmail: DEFAULT_SUPPORT_EMAIL,
      tenantStatus: "active",
      dealer: null,
      activeDomain: null,
    },
  });
});

publicRouter.get("/branding/:fileName", async (c) => {
  const fileName = c.req.param("fileName");
  if (basename(fileName) !== fileName || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(fileName)) {
    return c.json({ error: { code: "NOT_FOUND", message: "Bild nicht gefunden" } }, 404);
  }
  const extension = extname(fileName).toLowerCase();
  const contentType =
    extension === ".jpg" || extension === ".jpeg"
      ? "image/jpeg"
      : extension === ".png"
        ? "image/png"
        : extension === ".webp"
          ? "image/webp"
          : null;
  if (!contentType) {
    return c.json({ error: { code: "NOT_FOUND", message: "Bild nicht gefunden" } }, 404);
  }

  const tenant = await resolvePublicTenant(c.req.header("host"));
  const settings = tenant?.dealer?.settings;
  const allowedFiles = [settings?.logoUrl, settings?.faviconUrl]
    .filter((value): value is string => Boolean(value))
    .map((value) => basename(value));
  if (!allowedFiles.includes(fileName)) {
    return c.json({ error: { code: "NOT_FOUND", message: "Bild nicht gefunden" } }, 404);
  }

  const file = Bun.file(join(UPLOADS_DIR, fileName));
  if (!(await file.exists())) {
    return c.json({ error: { code: "NOT_FOUND", message: "Bild nicht gefunden" } }, 404);
  }
  c.header("Content-Type", contentType);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", "public, max-age=300");
  c.header("Content-Security-Policy", "default-src 'none'; sandbox");
  return c.body(file.stream() as unknown as ReadableStream);
});

publicRouter.post(
  "/signup",
  zValidator("json", PublicSignupSchema),
  async (c) => {
    const rate = consumeRateLimit(`signup:${getClientIp(c)}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.allowed) return rateLimitResponse(c, rate.retryAfterSeconds);

    const data = c.req.valid("json");
    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedUsername = data.username.trim();
    const plan = await prisma.plan.findFirst({
      where: {
        slug: data.planSlug,
        isActive: true,
      },
    });

    if (!plan) {
      return c.json({ error: { code: "PLAN_NOT_FOUND", message: "Tarif nicht gefunden" } }, 404);
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
      },
      select: { id: true },
    });

    if (existingUser) {
      return c.json(
        { error: { code: "USER_EXISTS", message: "E-Mail oder Benutzername ist bereits vergeben" } },
        409
      );
    }

    const slug = await createUniqueDealerSlug(data.companyName);
    const passwordHash = await hashPassword(data.password);
    const trialEndsAt = addTrialDays(new Date());

    const dealer = await prisma.$transaction(async (tx) => {
      const userId = randomUUID();

      await tx.user.create({
        data: {
          id: userId,
          name: data.ownerName.trim(),
          email: normalizedEmail,
          username: normalizedUsername,
          emailVerified: false,
          platformRole: "user",
        },
      });

      await tx.account.create({
        data: {
          id: randomUUID(),
          userId,
          accountId: userId,
          providerId: "credential",
          password: passwordHash,
        },
      });

      return tx.dealer.create({
        data: {
          name: data.companyName.trim(),
          slug,
          status: "active",
          setupStatus: "active",
          settings: {
            create: {
              displayName: data.companyName.trim(),
              legalName: data.companyName.trim(),
              supportEmail: normalizedEmail,
            },
          },
          memberships: {
            create: {
              userId,
              role: "dealer_owner",
              isDefault: true,
              isActive: true,
            },
          },
          subscriptions: {
            create: {
              planId: plan.id,
              status: "trialing",
              trialEndsAt,
              stripePriceId: plan.stripePriceMonthlyId,
            },
          },
        },
        select: {
          id: true,
          subscriptions: {
            where: { planId: plan.id },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
    });

    return c.json(
      {
        data: {
          dealerId: dealer.id,
          planSlug: data.planSlug,
          subscriptionStatus: dealer.subscriptions[0]?.status ?? "trialing",
          trialEndsAt: trialEndsAt.toISOString(),
        },
      },
      201
    );
  }
);

export { publicRouter };
