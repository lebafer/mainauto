import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { SaleCreateSchema } from "../types";
import { getCurrentDealerId } from "../lib/request-context";

const salesRouter = new Hono();

// GET /api/sales - list all sales with vehicle and customer info
salesRouter.get("/", async (c) => {
  const dealerId = getCurrentDealerId(c);
  const sales = await prisma.sale.findMany({
    where: { dealerId },
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
    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    // Check vehicle exists
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: data.vehicleId, dealerId },
    });
    if (!vehicle) {
      return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
    }

    if (vehicle.isPrivate) {
      return c.json(
        { error: { message: "Private Fahrzeuge koennen nicht verkauft werden", code: "PRIVATE_VEHICLE" } },
        400
      );
    }

    // Check customer exists
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, dealerId },
    });
    if (!customer) {
      return c.json({ error: { message: "Customer not found", code: "NOT_FOUND" } }, 404);
    }

    // Create sale and update vehicle status in a transaction
    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          dealerId,
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
  const dealerId = getCurrentDealerId(c);

  const existing = await prisma.sale.findFirst({
    where: { id, dealerId },
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
