import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";

const colorsRouter = new Hono();

// GET /api/colors - list all custom colors
colorsRouter.get("/", async (c) => {
  const colors = await prisma.customColor.findMany({
    orderBy: { name: "asc" },
  });
  return c.json({ data: colors.map((col) => col.name) });
});

// POST /api/colors - add a custom color
colorsRouter.post(
  "/",
  zValidator("json", z.object({ name: z.string().min(1).max(100) })),
  async (c) => {
    const { name } = c.req.valid("json");
    const trimmed = name.trim();

    // Upsert - ignore if already exists
    const color = await prisma.customColor.upsert({
      where: { name: trimmed },
      update: {},
      create: { name: trimmed },
    });
    return c.json({ data: color.name }, 201);
  }
);

// DELETE /api/colors/:name - remove a custom color
colorsRouter.delete("/:name", async (c) => {
  const name = decodeURIComponent(c.req.param("name"));
  await prisma.customColor.deleteMany({ where: { name } });
  return c.body(null, 204);
});

export { colorsRouter };
