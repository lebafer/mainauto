import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  AdminDealerCreateSchema,
  AdminDealerUpdateSchema,
  DealerSubscriptionUpdateSchema,
} from "../types";
import { requirePlatformSuperAdmin } from "../lib/request-context";
import { slugifyDealerName } from "../lib/dealers";
import { createCredentialUser } from "../lib/auth-users";

const adminRouter = new Hono();

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
      where: { slug: "basic" },
    });

    const dealer = await prisma.dealer.create({
      data: {
        name: data.name,
        slug,
        status: data.status,
        settings: {
          create: {
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

    const dealer = await prisma.dealer.update({
      where: { id: dealerId },
      data,
      include: {
        settings: true,
      },
    });

    return c.json({ data: dealer });
  }
);

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

export { adminRouter };
