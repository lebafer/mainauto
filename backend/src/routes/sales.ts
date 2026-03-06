import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { SaleCreateSchema } from "../types";

const salesRouter = new Hono();

// GET /api/sales - list all sales with vehicle and customer info
salesRouter.get("/", async (c) => {
  const sales = await prisma.sale.findMany({
    include: {
      vehicle: {
        include: { images: true },
      },
      customer: true,
    },
    orderBy: { saleDate: "desc" },
  });

  return c.json({ data: sales });
});

// POST /api/sales - create sale
salesRouter.post(
  "/",
  zValidator("json", SaleCreateSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Check vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: data.vehicleId },
    });
    if (!vehicle) {
      return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
    }

    // Check customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      return c.json({ error: { message: "Customer not found", code: "NOT_FOUND" } }, 404);
    }

    // Create sale and update vehicle status in a transaction
    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          vehicleId: data.vehicleId,
          customerId: data.customerId,
          salePrice: data.salePrice,
          taxRate: data.taxRate ?? 19.0,
          saleDate: data.saleDate ? new Date(data.saleDate) : new Date(),
          notes: data.notes,
        },
        include: {
          vehicle: true,
          customer: true,
        },
      });

      // Update vehicle status to sold and link customer
      await tx.vehicle.update({
        where: { id: data.vehicleId },
        data: {
          status: "sold",
          customerId: data.customerId,
        },
      });

      return newSale;
    });

    return c.json({ data: sale }, 201);
  }
);

// DELETE /api/sales/:id - delete sale (revert vehicle status)
salesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.sale.findUnique({
    where: { id },
    include: { vehicle: true },
  });

  if (!existing) {
    return c.json({ error: { message: "Sale not found", code: "NOT_FOUND" } }, 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.sale.delete({ where: { id } });

    // Revert vehicle status to available
    await tx.vehicle.update({
      where: { id: existing.vehicleId },
      data: {
        status: "available",
        customerId: null,
      },
    });
  });

  return c.body(null, 204);
});

export { salesRouter };
