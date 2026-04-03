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
  WEBSITE_VEHICLE_FEED_FEATURE_KEY,
  getTenantStatus,
  mergeFeatureEntitlements,
  slugifyDealerName,
} from "../lib/dealers";
import { addTrialDays, TRIAL_DAYS, getBillingState, getCurrentSubscription } from "../lib/billing";
import { hashWebsiteFeedToken, parseVehicleFeatures, toAbsoluteAssetUrl } from "../lib/website-feed";
import { PublicSignupSchema, WebsiteVehicleFeedResponseSchema } from "../types";

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

publicRouter.get("/website-feed/vehicles", async (c) => {
  const authHeader = c.req.header("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

  if (!bearerToken) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Bearer-Token fehlt",
        },
      },
      401
    );
  }

  const token = await prisma.dealerWebsiteFeedToken.findUnique({
    where: { tokenHash: hashWebsiteFeedToken(bearerToken) },
    include: {
      dealer: {
        include: {
          settings: true,
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: "desc" },
          },
          vehicles: {
            where: {
              showOnWebsite: true,
              isPrivate: false,
            },
            include: {
              images: {
                orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!token) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Ungültiger Feed-Token",
        },
      },
      401
    );
  }

  const dealer = token.dealer;
  const tenantStatus = getTenantStatus({
    dealerStatus: dealer.status,
    setupStatus: dealer.setupStatus,
  });

  if (tenantStatus === "suspended" || tenantStatus === "inactive") {
    return c.json(
      {
        error: {
          code: "TENANT_UNAVAILABLE",
          message: "Dieses Autohaus ist derzeit nicht verfügbar",
        },
      },
      403
    );
  }

  const subscription = getCurrentSubscription(dealer.subscriptions);
  const billing = getBillingState(subscription);
  if (!billing.canAccessApp) {
    return c.json(
      {
        error: {
          code: "PAYMENT_REQUIRED",
          message: "Das Autohaus hat derzeit keinen aktiven Zugriff",
        },
      },
      403
    );
  }

  const entitlements = mergeFeatureEntitlements(
    subscription?.plan.featureEntitlements,
    subscription?.featureOverrides
  );

  if (entitlements[WEBSITE_VEHICLE_FEED_FEATURE_KEY] !== true) {
    return c.json(
      {
        error: {
          code: "FEATURE_NOT_ENABLED",
          message: "Der Website-Fahrzeugfeed ist für dieses Autohaus nicht aktiviert",
        },
      },
      403
    );
  }

  await prisma.dealerWebsiteFeedToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  const response = WebsiteVehicleFeedResponseSchema.parse({
    dealer: {
      id: dealer.id,
      name: dealer.name,
      slug: dealer.slug,
      displayName: dealer.settings?.displayName ?? null,
      website: dealer.settings?.website ?? null,
      logoUrl: toAbsoluteAssetUrl(dealer.settings?.logoUrl),
      primaryColor: dealer.settings?.primaryColor ?? null,
      accentColor: dealer.settings?.accentColor ?? null,
      updatedAt: dealer.updatedAt.toISOString(),
    },
    vehicles: dealer.vehicles.map((vehicle) => {
      const images = vehicle.images.map((image) => ({
        id: image.id,
        url: toAbsoluteAssetUrl(image.url),
        isPrimary: image.isPrimary,
      }));
      const primaryImage = images.find((image) => image.isPrimary) ?? images[0] ?? null;

      return {
        id: vehicle.id,
        vehicleNumber: vehicle.vehicleNumber,
        brand: vehicle.brand,
        model: vehicle.model,
        title: [vehicle.brand, vehicle.model].filter(Boolean).join(" "),
        status: vehicle.status,
        sellingPrice: vehicle.sellingPrice,
        dealerPrice: vehicle.dealerPrice ?? null,
        taxRate: vehicle.taxRate,
        marginTaxed: vehicle.marginTaxed,
        primaryImageUrl: primaryImage?.url ?? null,
        images: images.filter((image): image is { id: string; url: string; isPrimary: boolean } => Boolean(image.url)),
        year: vehicle.year ?? null,
        firstRegistration: vehicle.firstRegistration?.toISOString() ?? null,
        mileage: vehicle.mileage,
        fuelType: vehicle.fuelType ?? null,
        transmission: vehicle.transmission ?? null,
        power: vehicle.power ?? null,
        powerKw: vehicle.powerKw ?? null,
        color: vehicle.color ?? null,
        bodyType: vehicle.bodyType ?? null,
        doors: vehicle.doors ?? null,
        seats: vehicle.seats ?? null,
        driveType: vehicle.driveType ?? null,
        emissionClass: vehicle.emissionClass ?? null,
        co2Emission: vehicle.co2Emission ?? null,
        batteryCapacity: vehicle.batteryCapacity ?? null,
        electricRange: vehicle.electricRange ?? null,
        batterySoh: vehicle.batterySoh ?? null,
        batteryType: vehicle.batteryType ?? null,
        chargingTime: vehicle.chargingTime ?? null,
        connectorType: vehicle.connectorType ?? null,
        huDue: vehicle.huDue?.toISOString() ?? null,
        previousOwners: vehicle.previousOwners ?? null,
        features: parseVehicleFeatures(vehicle.features),
        notes: vehicle.notes ?? null,
        createdAt: vehicle.createdAt.toISOString(),
        updatedAt: vehicle.updatedAt.toISOString(),
      };
    }),
  });

  return c.json({ data: response });
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
