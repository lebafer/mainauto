import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../prisma";
import { basename, join } from "path";
import { mkdir, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import {
  DealerWebsiteFeedTokenCreateResponseSchema,
  DealerWebsiteFeedTokenStatusSchema,
  DealerSettingsUpdateSchema,
  DealerTeamMemberCreateSchema,
  DealerTeamRoleUpdateSchema,
} from "../types";
import {
  getCurrentDealer,
  getCurrentDealerId,
  getCurrentEntitlements,
  getCurrentUser,
  requireDealerRole,
  requireEntitlement,
} from "../lib/request-context";
import { createCredentialUser } from "../lib/auth-users";
import { WEBSITE_VEHICLE_FEED_FEATURE_KEY } from "../lib/dealers";
import {
  createWebsiteFeedToken,
  formatWebsiteFeedTokenPreview,
  getWebsiteFeedUrl,
} from "../lib/website-feed";

const UPLOADS_DIR = join(import.meta.dir, "../../uploads");

if (!existsSync(UPLOADS_DIR)) {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

async function deleteDealerLogoFile(logoUrl: string | null | undefined) {
  if (!logoUrl?.startsWith("/api/uploads/")) {
    return;
  }

  const fileName = basename(logoUrl);
  const filePath = join(UPLOADS_DIR, fileName);

  try {
    await unlink(filePath);
  } catch {
    // Missing files should not block settings updates.
  }
}

async function ensureAnotherActiveOwnerExists(dealerId: string, membershipId: string) {
  const remainingActiveOwners = await prisma.dealerMembership.count({
    where: {
      dealerId,
      role: "dealer_owner",
      isActive: true,
      NOT: { id: membershipId },
    },
  });

  return remainingActiveOwners > 0;
}

const settingsRouter = new Hono();

function hasBrandingChanges(data: Record<string, unknown>) {
  return [
    "logoUrl",
    "documentFooterText",
    "documentLegalText",
    "purchaseTerms",
    "saleTerms",
  ].some((key) => {
    const value = data[key];
    return typeof value === "string" ? value.trim().length > 0 : value != null;
  });
}

settingsRouter.get("/dealer", async (c) => {
  const dealer = getCurrentDealer(c);
  const settings = await prisma.dealerSettings.findUnique({
    where: { dealerId: dealer.id },
  });

  return c.json({
    data: {
      dealer: {
        id: dealer.id,
        name: dealer.name,
        slug: dealer.slug,
        status: dealer.status,
        setupStatus: dealer.setupStatus,
        isDefault: dealer.isDefault,
      },
      settings,
    },
  });
});

settingsRouter.put(
  "/dealer",
  zValidator("json", DealerSettingsUpdateSchema),
  async (c) => {
    const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
    if (forbidden) {
      return forbidden;
    }

    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    if (hasBrandingChanges(data)) {
      const entitlementError = requireEntitlement(c, "document_branding");
      if (entitlementError) {
        return entitlementError;
      }
    }

    const settings = await prisma.dealerSettings.upsert({
      where: { dealerId },
      update: data,
      create: {
        dealerId,
        ...data,
      },
    });

    return c.json({ data: settings });
  }
);

settingsRouter.get("/website-feed", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) {
    return forbidden;
  }

  const dealerId = getCurrentDealerId(c);
  const token = await prisma.dealerWebsiteFeedToken.findUnique({
    where: { dealerId },
  });

  const response = DealerWebsiteFeedTokenStatusSchema.parse({
    enabled: getCurrentEntitlements(c)[WEBSITE_VEHICLE_FEED_FEATURE_KEY] === true,
    hasToken: Boolean(token),
    tokenPreview: token ? formatWebsiteFeedTokenPreview(token.tokenPrefix, token.tokenLast4) : null,
    feedUrl: getWebsiteFeedUrl(),
    lastUsedAt: token?.lastUsedAt?.toISOString() ?? null,
    updatedAt: token?.updatedAt?.toISOString() ?? null,
  });

  return c.json({ data: response });
});

settingsRouter.post("/website-feed/token", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) {
    return forbidden;
  }

  const featureError = requireEntitlement(c, WEBSITE_VEHICLE_FEED_FEATURE_KEY);
  if (featureError) {
    return featureError;
  }

  const dealerId = getCurrentDealerId(c);
  const userId = getCurrentUser(c).id;
  const nextToken = createWebsiteFeedToken();

  const token = await prisma.dealerWebsiteFeedToken.upsert({
    where: { dealerId },
    update: {
      tokenHash: nextToken.tokenHash,
      tokenPrefix: nextToken.tokenPrefix,
      tokenLast4: nextToken.tokenLast4,
      createdByUserId: userId,
      lastUsedAt: null,
    },
    create: {
      dealerId,
      tokenHash: nextToken.tokenHash,
      tokenPrefix: nextToken.tokenPrefix,
      tokenLast4: nextToken.tokenLast4,
      createdByUserId: userId,
    },
  });

  const response = DealerWebsiteFeedTokenCreateResponseSchema.parse({
    token: nextToken.rawToken,
    tokenPreview: nextToken.tokenPreview,
    feedUrl: getWebsiteFeedUrl(),
    createdAt: token.updatedAt.toISOString(),
  });

  return c.json({ data: response }, 201);
});

settingsRouter.delete("/website-feed/token", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) {
    return forbidden;
  }

  const dealerId = getCurrentDealerId(c);
  await prisma.dealerWebsiteFeedToken.deleteMany({
    where: { dealerId },
  });

  return c.json({ data: { success: true } });
});

settingsRouter.post("/dealer/logo", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) {
    return forbidden;
  }

  const featureError = requireEntitlement(c, "document_branding");
  if (featureError) {
    return featureError;
  }

  const dealerId = getCurrentDealerId(c);
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Kein Logo hochgeladen" } }, 400);
  }

  if (!file.type.startsWith("image/")) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Logo muss eine Bilddatei sein" } }, 400);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const fileName = `dealer-logo-${dealerId}-${randomUUID()}.${ext}`;
  const filePath = join(UPLOADS_DIR, fileName);
  const arrayBuffer = await file.arrayBuffer();
  await Bun.write(filePath, arrayBuffer);

  const existingSettings = await prisma.dealerSettings.findUnique({
    where: { dealerId },
    select: { logoUrl: true },
  });

  const settings = await prisma.dealerSettings.upsert({
    where: { dealerId },
    update: {
      logoUrl: `/api/uploads/${fileName}`,
    },
    create: {
      dealerId,
      logoUrl: `/api/uploads/${fileName}`,
    },
  });

  await deleteDealerLogoFile(existingSettings?.logoUrl);

  return c.json({
    data: {
      logoUrl: settings.logoUrl,
    },
  });
});

settingsRouter.delete("/dealer/logo", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) {
    return forbidden;
  }

  const featureError = requireEntitlement(c, "document_branding");
  if (featureError) {
    return featureError;
  }

  const dealerId = getCurrentDealerId(c);
  const existingSettings = await prisma.dealerSettings.findUnique({
    where: { dealerId },
    select: { logoUrl: true },
  });

  await prisma.dealerSettings.upsert({
    where: { dealerId },
    update: { logoUrl: null },
    create: {
      dealerId,
      logoUrl: null,
    },
  });

  await deleteDealerLogoFile(existingSettings?.logoUrl);

  return c.json({
    data: {
      logoUrl: null,
    },
  });
});

settingsRouter.get("/team", async (c) => {
  const featureError = requireEntitlement(c, "team_management");
  if (featureError) {
    return featureError;
  }

  const dealerId = getCurrentDealerId(c);

  const members = await prisma.dealerMembership.findMany({
    where: { dealerId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          platformRole: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return c.json({ data: members });
});

settingsRouter.post(
  "/team",
  zValidator("json", DealerTeamMemberCreateSchema),
  async (c) => {
    const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
    if (forbidden) {
      return forbidden;
    }

    const featureError = requireEntitlement(c, "team_management");
    if (featureError) {
      return featureError;
    }

    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existingUser) {
      return c.json(
        {
          error: {
            code: "USER_EXISTS",
            message: "Benutzer mit E-Mail oder Benutzername existiert bereits",
          },
        },
        409
      );
    }

    const user = await createCredentialUser({
      name: data.name,
      email: data.email,
      password: data.password,
      username: data.username,
    });

    const membership = await prisma.dealerMembership.create({
      data: {
        dealerId,
        userId: user.id,
        role: data.role,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            platformRole: true,
            createdAt: true,
          },
        },
      },
    });

    return c.json({ data: membership }, 201);
  }
);

settingsRouter.put(
  "/team/:membershipId",
  zValidator("json", DealerTeamRoleUpdateSchema),
  async (c) => {
    const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
    if (forbidden) {
      return forbidden;
    }

    const featureError = requireEntitlement(c, "team_management");
    if (featureError) {
      return featureError;
    }

    const dealerId = getCurrentDealerId(c);
    const membershipId = c.req.param("membershipId");
    const data = c.req.valid("json");

    const existing = await prisma.dealerMembership.findFirst({
      where: { id: membershipId, dealerId },
      include: {
        user: true,
      },
    });

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Teammitglied nicht gefunden" } }, 404);
    }

    const nextRole = data.role ?? existing.role;
    const nextIsActive = data.isActive ?? existing.isActive;
    const removesActiveOwner =
      existing.role === "dealer_owner" &&
      existing.isActive &&
      (nextRole !== "dealer_owner" || !nextIsActive);

    if (removesActiveOwner && !(await ensureAnotherActiveOwnerExists(dealerId, membershipId))) {
      return c.json(
        {
          error: {
            code: "LAST_OWNER",
            message: "Mindestens ein aktiver Owner muss im Autohaus verbleiben.",
          },
        },
        400
      );
    }

    const normalizedEmail = data.email?.trim().toLowerCase();
    const normalizedUsername = data.username === undefined ? undefined : data.username?.trim() || null;

    const userConflictChecks = [
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ...(normalizedUsername ? [{ username: normalizedUsername }] : []),
    ];

    if (userConflictChecks.length > 0) {
      const conflictingUser = await prisma.user.findFirst({
        where: {
          id: { not: existing.userId },
          OR: userConflictChecks,
        },
      });

      if (conflictingUser) {
        return c.json(
          {
            error: {
              code: "USER_EXISTS",
              message: "Benutzer mit E-Mail oder Benutzername existiert bereits",
            },
          },
          409
        );
      }
    }

    const passwordHash = data.password ? await hashPassword(data.password) : null;

    const membership = await prisma.$transaction(async (tx) => {
      if (
        data.name !== undefined ||
        normalizedEmail !== undefined ||
        normalizedUsername !== undefined
      ) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            ...(data.name !== undefined ? { name: data.name.trim() } : {}),
            ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
            ...(normalizedUsername !== undefined ? { username: normalizedUsername } : {}),
          },
        });
      }

      if (passwordHash) {
        const account = await tx.account.findFirst({
          where: {
            userId: existing.userId,
            providerId: "credential",
          },
        });

        if (account) {
          await tx.account.update({
            where: { id: account.id },
            data: { password: passwordHash },
          });
        } else {
          await tx.account.create({
            data: {
              id: randomUUID(),
              userId: existing.userId,
              accountId: existing.userId,
              providerId: "credential",
              password: passwordHash,
            },
          });
        }
      }

      return tx.dealerMembership.update({
        where: { id: membershipId },
        data: {
          ...(data.role !== undefined ? { role: data.role } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              platformRole: true,
              createdAt: true,
            },
          },
        },
      });
    });

    return c.json({ data: membership });
  }
);

settingsRouter.delete("/team/:membershipId", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) {
    return forbidden;
  }

  const featureError = requireEntitlement(c, "team_management");
  if (featureError) {
    return featureError;
  }

  const dealerId = getCurrentDealerId(c);
  const membershipId = c.req.param("membershipId");

  const membership = await prisma.dealerMembership.findFirst({
    where: { id: membershipId, dealerId },
  });

  if (!membership) {
    return c.json({ error: { code: "NOT_FOUND", message: "Teammitglied nicht gefunden" } }, 404);
  }

  if (
    membership.role === "dealer_owner" &&
    membership.isActive &&
    !(await ensureAnotherActiveOwnerExists(dealerId, membershipId))
  ) {
    return c.json(
      {
        error: {
          code: "LAST_OWNER",
          message: "Mindestens ein aktiver Owner muss im Autohaus verbleiben.",
        },
      },
      400
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.dealerMembership.delete({
      where: { id: membershipId },
    });

    const remainingMemberships = await tx.dealerMembership.count({
      where: { userId: membership.userId },
    });

    if (remainingMemberships === 0) {
      await tx.user.delete({
        where: { id: membership.userId },
      });
    }
  });

  return c.json({ data: { success: true } });
});

export { settingsRouter };
