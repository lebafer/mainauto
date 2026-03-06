import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";

const brandsRouter = new Hono();

// GET /api/brands - list all custom brands
brandsRouter.get("/", async (c) => {
  const brands = await prisma.customBrand.findMany({
    orderBy: { name: "asc" },
  });
  return c.json({ data: brands.map((b) => b.name) });
});

// POST /api/brands - add a custom brand
brandsRouter.post(
  "/",
  zValidator("json", z.object({ name: z.string().min(1).max(100) })),
  async (c) => {
    const { name } = c.req.valid("json");
    const trimmed = name.trim();

    // Upsert - ignore if already exists
    const brand = await prisma.customBrand.upsert({
      where: { name: trimmed },
      update: {},
      create: { name: trimmed },
    });
    return c.json({ data: brand.name }, 201);
  }
);

// DELETE /api/brands/:name - remove a custom brand
brandsRouter.delete("/:name", async (c) => {
  const name = decodeURIComponent(c.req.param("name"));
  await prisma.customBrand.deleteMany({ where: { name } });
  return c.body(null, 204);
});

export { brandsRouter };
