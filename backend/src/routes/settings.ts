import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { join } from "path";
import { mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import {
  DealerSettingsUpdateSchema,
  DealerTeamMemberCreateSchema,
  DealerTeamRoleUpdateSchema,
} from "../types";
import { getCurrentDealer, getCurrentDealerId, requireDealerRole } from "../lib/request-context";
import { createCredentialUser } from "../lib/auth-users";

const UPLOADS_DIR = join(import.meta.dir, "../../uploads");

if (!existsSync(UPLOADS_DIR)) {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

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

settingsRouter.post("/dealer/logo", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) {
    return forbidden;
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

  return c.json({
    data: {
      logoUrl: settings.logoUrl,
    },
  });
});

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
