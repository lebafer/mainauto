import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../prisma";
import { basename, join } from "path";
import { unlink } from "fs/promises";
import { randomUUID } from "crypto";
import {
  AdminDealerCreateSchema,
  AdminDealerUpdateSchema,
  DealerSubscriptionComplimentaryUpdateSchema,
  DealerSubscriptionUpdateSchema,
} from "../types";
import { requirePlatformSuperAdmin } from "../lib/request-context";
import { slugifyDealerName } from "../lib/dealers";
import { createCredentialUser } from "../lib/auth-users";

const adminRouter = new Hono();
const UPLOADS_DIR = join(import.meta.dir, "../../uploads");

async function deleteDealerLogoFile(logoUrl: string | null | undefined) {
  if (!logoUrl?.startsWith("/api/uploads/")) {
    return;
  }

  try {
    await unlink(join(UPLOADS_DIR, basename(logoUrl)));
  } catch {
    // Missing upload files should not block dealer deletion.
  }
}

adminRouter.use("*", async (c, next) => {
  const forbidden = requirePlatformSuperAdmin(c);
  if (forbidden) {
    return forbidden;
  }

  return next();
});

adminRouter.get("/dealers", async (c) => {
  const dealers = await prisma.dealer.findMany({
    include: {
      settings: true,
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
            },
          },
        },
      },
      subscriptions: {
        include: {
          plan: true,
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          vehicles: true,
          customers: true,
          suppliers: true,
          memberships: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: dealers });
});

adminRouter.get("/plans", async (c) => {
  const plans = await prisma.plan.findMany({
    orderBy: { monthlyPriceCents: "asc" },
  });

  return c.json({ data: plans });
});

adminRouter.post(
  "/dealers",
  zValidator("json", AdminDealerCreateSchema),
  async (c) => {
    const data = c.req.valid("json");
    const slug = data.slug?.trim() || slugifyDealerName(data.name);

    const existingDealer = await prisma.dealer.findUnique({ where: { slug } });
    if (existingDealer) {
      return c.json(
        { error: { code: "DEALER_EXISTS", message: "Ein Dealer mit diesem Slug existiert bereits" } },
        409
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.owner.email }, { username: data.owner.username }],
      },
    });
    if (existingUser) {
      return c.json(
        { error: { code: "OWNER_EXISTS", message: "Owner-Benutzer existiert bereits" } },
        409
      );
    }

    const owner = await createCredentialUser({
      name: data.owner.name,
      email: data.owner.email,
      password: data.owner.password,
      username: data.owner.username,
    });

    const basicPlan = await prisma.plan.findFirst({
      where: { slug: "standard" },
    });

    const dealer = await prisma.dealer.create({
      data: {
        name: data.name,
        slug,
        status: data.status,
        setupStatus: data.setupStatus ?? "active",
        settings: {
          create: {
            displayName: data.name,
            legalName: data.name,
          },
        },
        memberships: {
          create: {
            userId: owner.id,
            role: "dealer_owner",
            isDefault: true,
            isActive: true,
          },
        },
        subscriptions: basicPlan
          ? {
              create: {
                planId: basicPlan.id,
                status: "active",
              },
            }
          : undefined,
      },
      include: {
        settings: true,
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
              },
            },
          },
        },
        subscriptions: {
          include: { plan: true },
        },
      },
    });

    return c.json({ data: dealer }, 201);
  }
);

adminRouter.put(
  "/dealers/:dealerId",
  zValidator("json", AdminDealerUpdateSchema),
  async (c) => {
    const dealerId = c.req.param("dealerId");
    const data = c.req.valid("json");

    const existingDealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      include: {
        memberships: {
          where: { role: "dealer_owner" },
          orderBy: [{ createdAt: "asc" }],
          include: {
            user: true,
          },
        },
      },
    });

    if (!existingDealer) {
      return c.json({ error: { code: "NOT_FOUND", message: "Autohaus nicht gefunden" } }, 404);
    }

    const nextSlug = data.slug?.trim();
    if (nextSlug && nextSlug !== existingDealer.slug) {
      const conflictingDealer = await prisma.dealer.findUnique({
        where: { slug: nextSlug },
      });

      if (conflictingDealer) {
        return c.json(
          { error: { code: "DEALER_EXISTS", message: "Ein Dealer mit diesem Slug existiert bereits" } },
          409
        );
      }
    }

    const primaryOwnerMembership = existingDealer.memberships[0];
    if (!primaryOwnerMembership) {
      return c.json(
        { error: { code: "OWNER_NOT_FOUND", message: "Autohaus hat keinen zugeordneten Owner" } },
        400
      );
    }

    const normalizedOwnerEmail = data.owner?.email?.trim().toLowerCase();
    const normalizedOwnerUsername =
      data.owner?.username === undefined ? undefined : data.owner.username?.trim() || null;

    const ownerConflictChecks = [
      ...(normalizedOwnerEmail ? [{ email: normalizedOwnerEmail }] : []),
      ...(normalizedOwnerUsername ? [{ username: normalizedOwnerUsername }] : []),
    ];

    if (ownerConflictChecks.length > 0) {
      const conflictingUser = await prisma.user.findFirst({
        where: {
          id: { not: primaryOwnerMembership.userId },
          OR: ownerConflictChecks,
        },
      });

      if (conflictingUser) {
        return c.json(
          { error: { code: "OWNER_EXISTS", message: "Owner-Benutzer existiert bereits" } },
          409
        );
      }
    }

    const passwordHash = data.owner?.password ? await hashPassword(data.owner.password) : null;

    const dealer = await prisma.$transaction(async (tx) => {
      if (
        data.owner?.name !== undefined ||
        normalizedOwnerEmail !== undefined ||
        normalizedOwnerUsername !== undefined
      ) {
        await tx.user.update({
          where: { id: primaryOwnerMembership.userId },
          data: {
            ...(data.owner?.name !== undefined ? { name: data.owner.name.trim() } : {}),
            ...(normalizedOwnerEmail !== undefined ? { email: normalizedOwnerEmail } : {}),
            ...(normalizedOwnerUsername !== undefined ? { username: normalizedOwnerUsername } : {}),
          },
        });
      }

      if (passwordHash) {
        const account = await tx.account.findFirst({
          where: {
            userId: primaryOwnerMembership.userId,
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
              userId: primaryOwnerMembership.userId,
              accountId: primaryOwnerMembership.userId,
              providerId: "credential",
              password: passwordHash,
            },
          });
        }
      }

      return tx.dealer.update({
        where: { id: dealerId },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(nextSlug !== undefined ? { slug: nextSlug } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.setupStatus !== undefined ? { setupStatus: data.setupStatus } : {}),
          settings: data.name
            ? {
                upsert: {
                  update: {
                    displayName: data.name,
                    legalName: data.name,
                  },
                  create: {
                    displayName: data.name,
                    legalName: data.name,
                  },
                },
              }
            : undefined,
        },
        include: {
          settings: true,
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  username: true,
                },
              },
            },
          },
          subscriptions: {
            include: {
              plan: true,
            },
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              vehicles: true,
              customers: true,
              suppliers: true,
              memberships: true,
            },
          },
        },
      });
    });

    return c.json({ data: dealer });
  }
);

adminRouter.delete("/dealers/:dealerId", async (c) => {
  const dealerId = c.req.param("dealerId");

  const dealer = await prisma.dealer.findUnique({
    where: { id: dealerId },
    include: {
      settings: {
        select: {
          logoUrl: true,
        },
      },
      memberships: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!dealer) {
    return c.json({ error: { code: "NOT_FOUND", message: "Autohaus nicht gefunden" } }, 404);
  }

  if (dealer.isDefault) {
    return c.json(
      { error: { code: "DEFAULT_DEALER", message: "Der Standard-Dealer kann nicht gelöscht werden." } },
      400
    );
  }

  const affectedUserIds = [...new Set(dealer.memberships.map((membership) => membership.userId))];

  await prisma.$transaction(async (tx) => {
    await tx.dealer.delete({
      where: { id: dealerId },
    });

    for (const userId of affectedUserIds) {
      const remainingMemberships = await tx.dealerMembership.count({
        where: { userId },
      });

      if (remainingMemberships === 0) {
        await tx.user.delete({
          where: { id: userId },
        });
      }
    }
  });

  await deleteDealerLogoFile(dealer.settings?.logoUrl);

  return c.json({ data: { success: true } });
});

adminRouter.put(
  "/subscriptions/:dealerId",
  zValidator("json", DealerSubscriptionUpdateSchema),
  async (c) => {
    const dealerId = c.req.param("dealerId");
    const data = c.req.valid("json");

    const existingSubscriptions = await prisma.dealerSubscription.findMany({
      where: { dealerId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    const targetSubscription = existingSubscriptions.find((subscription) => subscription.planId === data.planId) ?? null;

    const subscription = await prisma.$transaction(async (tx) => {
      const targetId = targetSubscription?.id ?? null;
      const otherActiveIds = existingSubscriptions
        .filter((subscription) => subscription.id !== targetId)
        .map((subscription) => subscription.id);

      if (otherActiveIds.length > 0) {
        await tx.dealerSubscription.updateMany({
          where: { id: { in: otherActiveIds } },
          data: {
            status: "canceled",
            complimentaryAccess: false,
            endsAt: new Date(),
          },
        });
      }

      if (targetSubscription) {
        return tx.dealerSubscription.update({
          where: { id: targetSubscription.id },
          data: {
            status: data.status,
            complimentaryAccess: data.complimentaryAccess ?? targetSubscription.complimentaryAccess,
            featureOverrides: data.featureOverrides as Prisma.InputJsonValue | undefined,
            billingNotes: data.billingNotes ?? null,
            endsAt: data.endsAt ? new Date(data.endsAt) : null,
          },
          include: { plan: true },
        });
      }

      return tx.dealerSubscription.create({
        data: {
          dealerId,
          planId: data.planId,
          status: data.status,
          complimentaryAccess: data.complimentaryAccess ?? false,
          featureOverrides: data.featureOverrides as Prisma.InputJsonValue | undefined,
          billingNotes: data.billingNotes ?? null,
          endsAt: data.endsAt ? new Date(data.endsAt) : null,
        },
        include: { plan: true },
      });
    });

    return c.json({ data: subscription });
  }
);

adminRouter.put(
  "/subscriptions/:dealerId/complimentary",
  zValidator("json", DealerSubscriptionComplimentaryUpdateSchema),
  async (c) => {
    const dealerId = c.req.param("dealerId");
    const data = c.req.valid("json");

    const subscription = await prisma.dealerSubscription.findFirst({
      where: { dealerId },
      orderBy: [{ createdAt: "desc" }],
      include: { plan: true },
    });

    if (!subscription) {
      return c.json(
        { error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Für dieses Autohaus existiert noch kein Tarif." } },
        404
      );
    }

    const updatedSubscription = await prisma.dealerSubscription.update({
      where: { id: subscription.id },
      data: {
        complimentaryAccess: data.complimentaryAccess,
      },
      include: { plan: true },
    });

    return c.json({ data: updatedSubscription });
  }
);

export { adminRouter };
