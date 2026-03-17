import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import {
  DealerSettingsUpdateSchema,
  DealerTeamMemberCreateSchema,
  DealerTeamRoleUpdateSchema,
} from "../types";
import { auth } from "../auth";
import { getCurrentDealer, getCurrentDealerId, requireDealerRole } from "../lib/request-context";

const settingsRouter = new Hono();

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

settingsRouter.get("/team", async (c) => {
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

    await auth.api.signUpEmail({
      body: {
        name: data.name,
        email: data.email,
        password: data.password,
        username: data.username,
      },
    });

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return c.json(
        {
          error: {
            code: "USER_CREATE_FAILED",
            message: "Benutzer konnte nicht angelegt werden",
          },
        },
        500
      );
    }

    const membership = await prisma.dealerMembership.create({
      data: {
        dealerId,
        userId: user.id,
        role: data.role,
        isDefault: false,
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

    const dealerId = getCurrentDealerId(c);
    const membershipId = c.req.param("membershipId");
    const data = c.req.valid("json");

    const existing = await prisma.dealerMembership.findFirst({
      where: { id: membershipId, dealerId },
    });

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Teammitglied nicht gefunden" } }, 404);
    }

    if (data.isDefault) {
      await prisma.dealerMembership.updateMany({
        where: { dealerId },
        data: { isDefault: false },
      });
    }

    const membership = await prisma.dealerMembership.update({
      where: { id: membershipId },
      data,
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

    return c.json({ data: membership });
  }
);

export { settingsRouter };
