import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { getCurrentDealerId } from "../lib/request-context";

const suppliersRouter = new Hono();

// GET /api/suppliers - list all custom suppliers
suppliersRouter.get("/", async (c) => {
  const dealerId = getCurrentDealerId(c);
  const suppliers = await prisma.customSupplier.findMany({
    where: { dealerId },
    orderBy: { name: "asc" },
  });
  return c.json({ data: suppliers.map((s) => s.name) });
});

// POST /api/suppliers - add a custom supplier
suppliersRouter.post(
  "/",
  zValidator("json", z.object({ name: z.string().min(1).max(100) })),
  async (c) => {
    const dealerId = getCurrentDealerId(c);
    const { name } = c.req.valid("json");
    const trimmed = name.trim();

    const supplier = await prisma.customSupplier.upsert({
      where: {
        dealerId_name: {
          dealerId,
          name: trimmed,
        },
      },
      update: {},
      create: { dealerId, name: trimmed },
    });
    return c.json({ data: supplier.name }, 201);
  }
);

// DELETE /api/suppliers/:name - remove a custom supplier
suppliersRouter.delete("/:name", async (c) => {
  const dealerId = getCurrentDealerId(c);
  const name = decodeURIComponent(c.req.param("name"));
  await prisma.customSupplier.deleteMany({ where: { dealerId, name } });
  return c.body(null, 204);
});

export { suppliersRouter };
