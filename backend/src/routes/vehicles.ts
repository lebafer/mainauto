import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import {
  VehicleCreateSchema,
  VehicleUpdateSchema,
  VehicleCostCreateSchema,
  WorkLogItemCreateSchema,
  WorkLogItemUpdateSchema,
} from "../types";
import { join } from "path";
import { mkdir, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { existsSync } from "fs";

const UPLOADS_DIR = join(import.meta.dir, "../../uploads");

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

const vehiclesRouter = new Hono();

// GET /api/vehicles - list all vehicles with optional filters
vehiclesRouter.get("/", async (c) => {
  const status = c.req.query("status");
  const search = c.req.query("search");

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { brand: { contains: search } },
      { model: { contains: search } },
      { vin: { contains: search } },
      { color: { contains: search } },
    ];
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    include: {
      images: true,
      customer: true,
      supplierRel: true,
      _count: {
        select: { sales: true, documents: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: vehicles });
});

// GET /api/vehicles/:id - get single vehicle with relations
vehiclesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      images: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      customer: true,
      supplierRel: true,
      sales: {
        include: { customer: true },
        orderBy: { saleDate: "desc" },
      },
      costs: { orderBy: { createdAt: "asc" } },
      workLog: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!vehicle) {
    return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({ data: vehicle });
});

// Generate a unique sequential vehicle number: FZ-YYYY-NNNNN
async function generateVehicleNumber(): Promise<string> {
  const year = new Date().getFullYear();
  // Atomically increment counter
  const counter = await prisma.counter.upsert({
    where: { id: "vehicle" },
    update: { value: { increment: 1 } },
    create: { id: "vehicle", value: 1 },
  });
  const seq = String(counter.value).padStart(5, "0");
  return `FZ-${year}-${seq}`;
}

// POST /api/vehicles - create vehicle
vehiclesRouter.post(
  "/",
  zValidator("json", VehicleCreateSchema),
  async (c) => {
    const data = c.req.valid("json");

    const vehicleNumber = await generateVehicleNumber();

    // Convert power (number) to string for Prisma, strip empty strings
    const firstReg = data.firstRegistration ? new Date(data.firstRegistration) : null;
    const vehicleData = {
      ...data,
      vehicleNumber,
      year: data.year ?? (firstReg ? firstReg.getFullYear() : new Date().getFullYear()),
      power: data.power !== undefined ? String(data.power) : undefined,
      vin: data.vin || null,
      color: data.color || null,
      fuelType: data.fuelType || null,
      transmission: data.transmission || null,
      notes: data.notes || null,
      customerId: data.customerId || null,
      features: data.features || null,
      // New nullable string/number fields
      damageDescription: data.damageDescription || null,
      batteryType: data.batteryType || null,
      co2Emission: data.co2Emission ?? null,
      displacement: data.displacement ?? null,
      powerKw: data.powerKw ?? null,
      damageAmount: data.damageAmount ?? null,
      batteryCapacity: data.batteryCapacity ?? null,
      electricRange: data.electricRange ?? null,
      batterySoh: data.batterySoh ?? null,
      transportCostDomestic: data.transportCostDomestic ?? null,
      transportCostAbroad: data.transportCostAbroad ?? null,
      customsDuties: data.customsDuties ?? null,
      registrationFees: data.registrationFees ?? null,
      repairCostsAbroad: data.repairCostsAbroad ?? null,
      // Additional fields
      firstRegistration: data.firstRegistration ? new Date(data.firstRegistration) : null,
      supplier: data.supplier || null,
      chargingTime: data.chargingTime ?? null,
      connectorType: data.connectorType || null,
      // Supplier relation
      supplierId: data.supplierId ?? null,
      // Inspection / Service
      huDue: data.huDue ? new Date(data.huDue) : null,
      previousOwners: data.previousOwners ?? null,
      serviceDueKm: data.serviceDueKm ?? null,
      serviceDueDate: data.serviceDueDate ? new Date(data.serviceDueDate) : null,
      // Body / Configuration
      bodyType: data.bodyType || null,
      doors: data.doors ?? null,
      seats: data.seats ?? null,
      driveType: data.driveType || null,
      emissionClass: data.emissionClass || null,
      dealerPrice: data.dealerPrice ?? null,
    };

    const vehicle = await prisma.vehicle.create({
      data: vehicleData,
      include: {
        images: true,
        customer: true,
      },
    });

    return c.json({ data: vehicle }, 201);
  }
);

// PUT /api/vehicles/:id - update vehicle
vehiclesRouter.put(
  "/:id",
  zValidator("json", VehicleUpdateSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
    }

    // Handle nullable customerId: convert null to disconnect
    const updateData: Record<string, unknown> = {
      ...data,
      power: data.power !== undefined ? String(data.power) : undefined,
      vin: data.vin !== undefined ? (data.vin || null) : undefined,
      color: data.color !== undefined ? (data.color || null) : undefined,
      fuelType: data.fuelType !== undefined ? (data.fuelType || null) : undefined,
      transmission: data.transmission !== undefined ? (data.transmission || null) : undefined,
      notes: data.notes !== undefined ? (data.notes || null) : undefined,
      // New nullable string fields
      damageDescription: data.damageDescription !== undefined ? (data.damageDescription || null) : undefined,
      batteryType: data.batteryType !== undefined ? (data.batteryType || null) : undefined,
      // Additional new fields
      firstRegistration: data.firstRegistration !== undefined ? (data.firstRegistration ? new Date(data.firstRegistration) : null) : undefined,
      supplier: data.supplier !== undefined ? (data.supplier || null) : undefined,
      chargingTime: data.chargingTime !== undefined ? (data.chargingTime ?? null) : undefined,
      connectorType: data.connectorType !== undefined ? (data.connectorType || null) : undefined,
      // Supplier relation
      supplierId: data.supplierId !== undefined ? (data.supplierId ?? null) : undefined,
      // Inspection / Service
      huDue: data.huDue !== undefined ? (data.huDue ? new Date(data.huDue) : null) : undefined,
      previousOwners: data.previousOwners !== undefined ? (data.previousOwners ?? null) : undefined,
      serviceDueKm: data.serviceDueKm !== undefined ? (data.serviceDueKm ?? null) : undefined,
      serviceDueDate: data.serviceDueDate !== undefined ? (data.serviceDueDate ? new Date(data.serviceDueDate) : null) : undefined,
      // Body / Configuration
      bodyType: data.bodyType !== undefined ? (data.bodyType || null) : undefined,
      doors: data.doors !== undefined ? (data.doors ?? null) : undefined,
      seats: data.seats !== undefined ? (data.seats ?? null) : undefined,
      driveType: data.driveType !== undefined ? (data.driveType || null) : undefined,
      emissionClass: data.emissionClass !== undefined ? (data.emissionClass || null) : undefined,
      dealerPrice: data.dealerPrice !== undefined ? (data.dealerPrice ?? null) : undefined,
    };

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: updateData,
      include: {
        images: true,
        documents: true,
        customer: true,
        supplierRel: true,
        workLog: { orderBy: { createdAt: "asc" } },
      },
    });

    return c.json({ data: vehicle });
  }
);

// DELETE /api/vehicles/:id - delete vehicle
vehiclesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.vehicle.findUnique({
    where: { id },
    include: { images: true, documents: true },
  });

  if (!existing) {
    return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
  }

  // Delete associated files from disk
  for (const image of existing.images) {
    const filePath = join(UPLOADS_DIR, image.fileName);
    try {
      await unlink(filePath);
    } catch {
      // File may already be deleted
    }
  }
  for (const doc of existing.documents) {
    const filePath = join(UPLOADS_DIR, doc.fileName);
    try {
      await unlink(filePath);
    } catch {
      // File may already be deleted
    }
  }

  await prisma.vehicle.delete({ where: { id } });

  return c.body(null, 204);
});

// POST /api/vehicles/:id/images - upload image
vehiclesRouter.post("/:id/images", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const isPrimary = formData.get("isPrimary") === "true";

  if (!file) {
    return c.json({ error: { message: "No file provided", code: "BAD_REQUEST" } }, 400);
  }

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${randomUUID()}.${ext}`;
  const filePath = join(UPLOADS_DIR, fileName);

  const arrayBuffer = await file.arrayBuffer();
  await Bun.write(filePath, arrayBuffer);
  console.info(`[uploads] vehicle_image_saved vehicleId=${id} file=${fileName}`);

  // If this image is set as primary, unset others
  if (isPrimary) {
    await prisma.vehicleImage.updateMany({
      where: { vehicleId: id },
      data: { isPrimary: false },
    });
  }

  const image = await prisma.vehicleImage.create({
    data: {
      url: `/api/uploads/${fileName}`,
      fileName,
      isPrimary,
      vehicleId: id,
    },
  });

  return c.json({ data: image }, 201);
});

// DELETE /api/vehicles/:id/images/:imageId - delete image
vehiclesRouter.delete("/:id/images/:imageId", async (c) => {
  const imageId = c.req.param("imageId");

  const image = await prisma.vehicleImage.findUnique({ where: { id: imageId } });
  if (!image) {
    return c.json({ error: { message: "Image not found", code: "NOT_FOUND" } }, 404);
  }

  // Delete file from disk
  const filePath = join(UPLOADS_DIR, image.fileName);
  try {
    await unlink(filePath);
  } catch {
    // File may already be deleted
  }

  await prisma.vehicleImage.delete({ where: { id: imageId } });

  return c.body(null, 204);
});

// POST /api/vehicles/:id/documents - upload document
vehiclesRouter.post("/:id/documents", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string) || file?.name || "Untitled";

  if (!file) {
    return c.json({ error: { message: "No file provided", code: "BAD_REQUEST" } }, 400);
  }

  const ext = file.name.split(".").pop() || "pdf";
  const fileName = `${randomUUID()}.${ext}`;
  const filePath = join(UPLOADS_DIR, fileName);

  const arrayBuffer = await file.arrayBuffer();
  await Bun.write(filePath, arrayBuffer);
  console.info(`[uploads] vehicle_document_saved vehicleId=${id} file=${fileName}`);

  const doc = await prisma.vehicleDocument.create({
    data: {
      name,
      url: `/api/uploads/${fileName}`,
      fileName,
      fileType: file.type || null,
      vehicleId: id,
    },
  });

  return c.json({ data: doc }, 201);
});

// DELETE /api/vehicles/:id/documents/:docId - delete document
vehiclesRouter.delete("/:id/documents/:docId", async (c) => {
  const docId = c.req.param("docId");

  const doc = await prisma.vehicleDocument.findUnique({ where: { id: docId } });
  if (!doc) {
    return c.json({ error: { message: "Document not found", code: "NOT_FOUND" } }, 404);
  }

  // Delete file from disk
  const filePath = join(UPLOADS_DIR, doc.fileName);
  try {
    await unlink(filePath);
  } catch {
    // File may already be deleted
  }

  await prisma.vehicleDocument.delete({ where: { id: docId } });

  return c.body(null, 204);
});

// POST /api/vehicles/:id/costs - add a cost to a vehicle
vehiclesRouter.post(
  "/:id/costs",
  zValidator("json", VehicleCostCreateSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
    }

    const cost = await prisma.vehicleCost.create({
      data: {
        vehicleId: id,
        costType: data.costType,
        amount: data.amount,
        notes: data.notes || null,
      },
    });

    return c.json({ data: cost }, 201);
  }
);

// DELETE /api/vehicles/:id/costs/:costId - delete a cost
vehiclesRouter.delete("/:id/costs/:costId", async (c) => {
  const costId = c.req.param("costId");

  const cost = await prisma.vehicleCost.findUnique({ where: { id: costId } });
  if (!cost) {
    return c.json({ error: { message: "Cost not found", code: "NOT_FOUND" } }, 404);
  }

  await prisma.vehicleCost.delete({ where: { id: costId } });

  return c.body(null, 204);
});

// POST /api/vehicles/:id/worklog - create work log item
vehiclesRouter.post(
  "/:id/worklog",
  zValidator("json", WorkLogItemCreateSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
    }

    const item = await prisma.workLogItem.create({
      data: {
        vehicleId: id,
        description: data.description,
        status: data.status ?? "open",
        assignee: data.assignee || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });

    return c.json({ data: item }, 201);
  }
);

// PUT /api/vehicles/:id/worklog/:itemId - update work log item
vehiclesRouter.put(
  "/:id/worklog/:itemId",
  zValidator("json", WorkLogItemUpdateSchema),
  async (c) => {
    const itemId = c.req.param("itemId");
    const data = c.req.valid("json");

    const existing = await prisma.workLogItem.findUnique({ where: { id: itemId } });
    if (!existing) {
      return c.json({ error: { message: "WorkLog item not found", code: "NOT_FOUND" } }, 404);
    }

    const item = await prisma.workLogItem.update({
      where: { id: itemId },
      data: {
        ...data,
        dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
        assignee: data.assignee !== undefined ? (data.assignee || null) : undefined,
      },
    });

    return c.json({ data: item });
  }
);

// DELETE /api/vehicles/:id/worklog/:itemId - delete work log item
vehiclesRouter.delete("/:id/worklog/:itemId", async (c) => {
  const itemId = c.req.param("itemId");

  const existing = await prisma.workLogItem.findUnique({ where: { id: itemId } });
  if (!existing) {
    return c.json({ error: { message: "WorkLog item not found", code: "NOT_FOUND" } }, 404);
  }

  await prisma.workLogItem.delete({ where: { id: itemId } });

  return c.body(null, 204);
});

export { vehiclesRouter };
