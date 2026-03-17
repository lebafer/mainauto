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
  DealerDomainActivateSchema,
  DealerDomainCreateSchema,
  DealerDomainVerifySchema,
  DealerSubscriptionUpdateSchema,
} from "../types";
import { requirePlatformSuperAdmin } from "../lib/request-context";
import { createFallbackDealerHost, normalizeHost, slugifyDealerName } from "../lib/dealers";
import { createCredentialUser } from "../lib/auth-users";

const adminRouter = new Hono();
const UPLOADS_DIR = join(import.meta.dir, "../../uploads");

function isValidHost(value: string): boolean {
  const normalized = normalizeHost(value);
  if (!normalized || normalized.length > 253) {
    return false;
  }

  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(normalized);
}

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
      domains: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
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

adminRouter.get("/inquiries", async (c) => {
  const inquiries = await prisma.onboardingInquiry.findMany({
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: inquiries });
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
      where: { slug: "basic" },
    });

    const dealer = await prisma.dealer.create({
      data: {
        name: data.name,
        slug,
        status: data.status,
        setupStatus: data.setupStatus ?? "pending_setup",
        settings: {
          create: {
            displayName: data.name,
            legalName: data.name,
          },
        },
        domains: {
          create: {
            host: createFallbackDealerHost(slug),
            status: "active",
            isPrimary: true,
            verificationToken: null,
            verifiedAt: new Date(),
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
        domains: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
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

      if (nextSlug && nextSlug !== existingDealer.slug) {
        await tx.dealerDomain.updateMany({
          where: {
            dealerId,
            host: createFallbackDealerHost(existingDealer.slug),
          },
          data: {
            host: createFallbackDealerHost(nextSlug),
          },
        });
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
          domains: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
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

    const existing = await prisma.dealerSubscription.findFirst({
      where: {
        dealerId,
        planId: data.planId,
      },
    });

    const subscription = existing
      ? await prisma.dealerSubscription.update({
          where: { id: existing.id },
          data: {
            status: data.status,
            featureOverrides: data.featureOverrides as Prisma.InputJsonValue | undefined,
            billingNotes: data.billingNotes ?? null,
            endsAt: data.endsAt ? new Date(data.endsAt) : null,
          },
          include: { plan: true },
        })
      : await prisma.dealerSubscription.create({
          data: {
            dealerId,
            planId: data.planId,
            status: data.status,
            featureOverrides: data.featureOverrides as Prisma.InputJsonValue | undefined,
            billingNotes: data.billingNotes ?? null,
            endsAt: data.endsAt ? new Date(data.endsAt) : null,
          },
          include: { plan: true },
        });

    return c.json({ data: subscription });
  }
);

adminRouter.post(
  "/dealers/:dealerId/domains",
  zValidator("json", DealerDomainCreateSchema),
  async (c) => {
    const dealerId = c.req.param("dealerId");
    const data = c.req.valid("json");
    const host = normalizeHost(data.host);

    if (!isValidHost(host)) {
      return c.json({ error: { code: "INVALID_HOST", message: "Host ist ungueltig" } }, 400);
    }

    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!dealer) {
      return c.json({ error: { code: "NOT_FOUND", message: "Autohaus nicht gefunden" } }, 404);
    }

    const activeSubscription =
      dealer.subscriptions.find((item) => item.status === "active" || item.status === "trialing") ?? null;
    const entitlements = {
      ...(activeSubscription?.plan.featureEntitlements as Record<string, boolean> | undefined),
      ...((activeSubscription?.featureOverrides as Record<string, boolean> | undefined) ?? {}),
    };

    if (entitlements.custom_domain !== true) {
      return c.json(
        { error: { code: "FEATURE_NOT_ENABLED", message: "Custom Domains sind fuer diesen Tarif nicht aktiv" } },
        403
      );
    }

    const existing = await prisma.dealerDomain.findUnique({
      where: { host },
    });

    if (existing) {
      return c.json({ error: { code: "DOMAIN_EXISTS", message: "Domain ist bereits vergeben" } }, 409);
    }

    const domain = await prisma.dealerDomain.create({
      data: {
        dealerId,
        host,
        status: "pending_dns",
        isPrimary: false,
        verificationToken: randomUUID(),
      },
    });

    await prisma.dealer.update({
      where: { id: dealerId },
      data: {
        setupStatus: dealer.setupStatus === "pending_setup" ? "ready_for_dns" : dealer.setupStatus,
      },
    });

    return c.json({ data: domain }, 201);
  }
);

adminRouter.post(
  "/domains/:domainId/verify",
  zValidator("json", DealerDomainVerifySchema),
  async (c) => {
    const domainId = c.req.param("domainId");
    const data = c.req.valid("json");

    const domain = await prisma.dealerDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return c.json({ error: { code: "NOT_FOUND", message: "Domain nicht gefunden" } }, 404);
    }

    const nextStatus = data.status === "pending_dns" ? "pending_dns" : domain.status;

    const updated = await prisma.dealerDomain.update({
      where: { id: domainId },
      data: {
        status: nextStatus,
        verificationToken: domain.verificationToken ?? randomUUID(),
      },
    });

    return c.json({ data: updated });
  }
);

adminRouter.put(
  "/domains/:domainId/activate",
  zValidator("json", DealerDomainActivateSchema),
  async (c) => {
    const domainId = c.req.param("domainId");
    const data = c.req.valid("json");

    const domain = await prisma.dealerDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return c.json({ error: { code: "NOT_FOUND", message: "Domain nicht gefunden" } }, 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.dealerDomain.updateMany({
          where: { dealerId: domain.dealerId },
          data: { isPrimary: false },
        });
      }

      const activatedDomain = await tx.dealerDomain.update({
        where: { id: domainId },
        data: {
          status: data.status,
          isPrimary: data.isPrimary,
          verifiedAt: data.status === "active" ? new Date() : null,
          verificationToken: data.status === "active" ? null : domain.verificationToken,
        },
      });

      await tx.dealer.update({
        where: { id: domain.dealerId },
        data: {
          setupStatus: data.status === "active" ? "active" : "ready_for_dns",
        },
      });

      return activatedDomain;
    });

    return c.json({ data: updated });
  }
);

adminRouter.delete("/domains/:domainId", async (c) => {
  const domainId = c.req.param("domainId");

  const domain = await prisma.dealerDomain.findUnique({
    where: { id: domainId },
  });

  if (!domain) {
    return c.json({ error: { code: "NOT_FOUND", message: "Domain nicht gefunden" } }, 404);
  }

  let fallbackDomainId: string | null = null;

  if (domain.isPrimary && domain.status === "active") {
    const fallbackDomain = await prisma.dealerDomain.findFirst({
      where: {
        dealerId: domain.dealerId,
        id: { not: domain.id },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    if (!fallbackDomain) {
      return c.json(
        { error: { code: "PRIMARY_DOMAIN_REQUIRED", message: "Es muss mindestens eine Domain verbleiben" } },
        400
      );
    }

    fallbackDomainId = fallbackDomain.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.dealerDomain.delete({
      where: { id: domainId },
    });

    if (fallbackDomainId) {
      await tx.dealerDomain.update({
        where: { id: fallbackDomainId },
        data: {
          isPrimary: true,
          status: "active",
          verifiedAt: new Date(),
        },
      });
    }
  });

  return c.json({ data: { success: true } });
});

export { adminRouter };
