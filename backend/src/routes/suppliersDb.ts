import { Hono } from "hono";
import { prisma } from "../prisma";
import { SupplierCreateSchema, SupplierUpdateSchema } from "../types";

const suppliersDbRouter = new Hono();

// GET /api/suppliers-db - list all suppliers
suppliersDbRouter.get("/", async (c) => {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { vehicles: true } },
    },
  });
  return c.json({ data: suppliers });
});

// GET /api/suppliers-db/:id - get single supplier with vehicles
suppliersDbRouter.get("/:id", async (c) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: c.req.param("id") },
    include: {
      vehicles: {
        select: {
          id: true,
          vehicleNumber: true,
          brand: true,
          model: true,
          purchasePrice: true,
          status: true,
          firstRegistration: true,
          year: true,
          mileage: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!supplier) return c.json({ error: { message: "Not found" } }, 404);
  return c.json({ data: supplier });
});

// POST /api/suppliers-db - create supplier
suppliersDbRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = SupplierCreateSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: { message: "Validation error", details: parsed.error } }, 400);
  const supplier = await prisma.supplier.create({ data: parsed.data });
  return c.json({ data: supplier }, 201);
});

// PUT /api/suppliers-db/:id - update supplier
suppliersDbRouter.put("/:id", async (c) => {
  const body = await c.req.json();
  const parsed = SupplierUpdateSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: { message: "Validation error" } }, 400);
  const supplier = await prisma.supplier.update({
    where: { id: c.req.param("id") },
    data: parsed.data,
  });
  return c.json({ data: supplier });
});

// DELETE /api/suppliers-db/:id - delete supplier
suppliersDbRouter.delete("/:id", async (c) => {
  await prisma.supplier.delete({ where: { id: c.req.param("id") } });
  return c.body(null, 204);
});

export { suppliersDbRouter };
