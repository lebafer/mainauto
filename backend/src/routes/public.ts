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
} from "../lib/dealers";
import { addTrialDays, TRIAL_DAYS } from "../lib/billing";
import { PublicSignupSchema } from "../types";

const publicRouter = new Hono();

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

publicRouter.post(
  "/signup",
  zValidator("json", PublicSignupSchema),
  async (c) => {
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
