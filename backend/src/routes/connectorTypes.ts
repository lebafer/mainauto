import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";

const connectorTypesRouter = new Hono();

// GET /api/connector-types - list all custom connector types
connectorTypesRouter.get("/", async (c) => {
  const connectorTypes = await prisma.customConnectorType.findMany({
    orderBy: { name: "asc" },
  });
  return c.json({ data: connectorTypes.map((ct) => ct.name) });
});

// POST /api/connector-types - add a custom connector type
connectorTypesRouter.post(
  "/",
  zValidator("json", z.object({ name: z.string().min(1).max(100) })),
  async (c) => {
    const { name } = c.req.valid("json");
    const trimmed = name.trim();

    // Upsert - ignore if already exists
    const connectorType = await prisma.customConnectorType.upsert({
      where: { name: trimmed },
      update: {},
      create: { name: trimmed },
    });
    return c.json({ data: connectorType.name }, 201);
  }
);

// DELETE /api/connector-types/:name - remove a custom connector type
connectorTypesRouter.delete("/:name", async (c) => {
  const name = decodeURIComponent(c.req.param("name"));
  await prisma.customConnectorType.deleteMany({ where: { name } });
  return c.body(null, 204);
});

export { connectorTypesRouter };
