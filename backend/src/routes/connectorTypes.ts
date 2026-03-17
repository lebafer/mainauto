import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { getCurrentDealerId } from "../lib/request-context";

const connectorTypesRouter = new Hono();

// GET /api/connector-types - list all custom connector types
connectorTypesRouter.get("/", async (c) => {
  const dealerId = getCurrentDealerId(c);
  const connectorTypes = await prisma.customConnectorType.findMany({
    where: { dealerId },
    orderBy: { name: "asc" },
  });
  return c.json({ data: connectorTypes.map((ct) => ct.name) });
});

// POST /api/connector-types - add a custom connector type
connectorTypesRouter.post(
  "/",
  zValidator("json", z.object({ name: z.string().min(1).max(100) })),
  async (c) => {
    const dealerId = getCurrentDealerId(c);
    const { name } = c.req.valid("json");
    const trimmed = name.trim();

    const connectorType = await prisma.customConnectorType.upsert({
      where: {
        dealerId_name: {
          dealerId,
          name: trimmed,
        },
      },
      update: {},
      create: { dealerId, name: trimmed },
    });
    return c.json({ data: connectorType.name }, 201);
  }
);

// DELETE /api/connector-types/:name - remove a custom connector type
connectorTypesRouter.delete("/:name", async (c) => {
  const dealerId = getCurrentDealerId(c);
  const name = decodeURIComponent(c.req.param("name"));
  await prisma.customConnectorType.deleteMany({ where: { dealerId, name } });
  return c.body(null, 204);
});

export { connectorTypesRouter };
