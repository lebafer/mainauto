import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { getCurrentDealerId } from "../lib/request-context";

const colorsRouter = new Hono();

// GET /api/colors - list all custom colors
colorsRouter.get("/", async (c) => {
  const dealerId = getCurrentDealerId(c);
  const colors = await prisma.customColor.findMany({
    where: { dealerId },
    orderBy: { name: "asc" },
  });
  return c.json({ data: colors.map((col) => col.name) });
});

// POST /api/colors - add a custom color
colorsRouter.post(
  "/",
  zValidator("json", z.object({ name: z.string().min(1).max(100) })),
  async (c) => {
    const dealerId = getCurrentDealerId(c);
    const { name } = c.req.valid("json");
    const trimmed = name.trim();

    const color = await prisma.customColor.upsert({
      where: {
        dealerId_name: {
          dealerId,
          name: trimmed,
        },
      },
      update: {},
      create: { dealerId, name: trimmed },
    });
    return c.json({ data: color.name }, 201);
  }
);

// DELETE /api/colors/:name - remove a custom color
colorsRouter.delete("/:name", async (c) => {
  const dealerId = getCurrentDealerId(c);
  const name = decodeURIComponent(c.req.param("name"));
  await prisma.customColor.deleteMany({ where: { dealerId, name } });
  return c.body(null, 204);
});

export { colorsRouter };
