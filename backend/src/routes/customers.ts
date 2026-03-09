import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { CustomerCreateSchema, CustomerUpdateSchema } from "../types";
import { join } from "path";
import { mkdir, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { existsSync } from "fs";

const UPLOADS_DIR = join(import.meta.dir, "../../uploads");

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

const customersRouter = new Hono();

// GET /api/customers - list all customers with optional search
customersRouter.get("/", async (c) => {
  const search = c.req.query("search");

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
      { company: { contains: search } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      _count: {
        select: { vehicles: true, sales: true, documents: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: customers });
});

// GET /api/customers/:id - get single customer with relations
customersRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      vehicles: {
        include: { images: true },
        orderBy: { createdAt: "desc" },
      },
      documents: { orderBy: { createdAt: "desc" } },
      sales: {
        include: { vehicle: true },
        orderBy: { saleDate: "desc" },
      },
    },
  });

  if (!customer) {
    return c.json({ error: { message: "Customer not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({ data: customer });
});

// POST /api/customers - create customer
customersRouter.post(
  "/",
  zValidator("json", CustomerCreateSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Convert empty strings to null for nullable fields and parse date
    const createData = {
      ...data,
      email: data.email === "" ? null : data.email,
      idDocumentType: data.idDocumentType ? data.idDocumentType : null,
      idDocumentNumber: data.idDocumentNumber ? data.idDocumentNumber : null,
      idDocumentValidUntil: data.idDocumentValidUntil ? new Date(data.idDocumentValidUntil) : null,
    };

    const customer = await prisma.customer.create({
      data: createData,
    });

    return c.json({ data: customer }, 201);
  }
);

// PUT /api/customers/:id - update customer
customersRouter.put(
  "/:id",
  zValidator("json", CustomerUpdateSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: { message: "Customer not found", code: "NOT_FOUND" } }, 404);
    }

    // Convert empty strings to null for nullable fields and parse date
    const updateData = {
      ...data,
      email: data.email === "" ? null : data.email,
      idDocumentType: data.idDocumentType !== undefined ? (data.idDocumentType || null) : undefined,
      idDocumentNumber: data.idDocumentNumber !== undefined ? (data.idDocumentNumber || null) : undefined,
      idDocumentValidUntil: data.idDocumentValidUntil !== undefined
        ? (data.idDocumentValidUntil ? new Date(data.idDocumentValidUntil) : null)
        : undefined,
    };

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
    });

    return c.json({ data: customer });
  }
);

// DELETE /api/customers/:id - delete customer
customersRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.customer.findUnique({
    where: { id },
    include: { documents: true },
  });

  if (!existing) {
    return c.json({ error: { message: "Customer not found", code: "NOT_FOUND" } }, 404);
  }

  // Delete associated files from disk
  for (const doc of existing.documents) {
    const filePath = join(UPLOADS_DIR, doc.fileName);
    try {
      await unlink(filePath);
    } catch {
      // File may already be deleted
    }
  }

  await prisma.customer.delete({ where: { id } });

  return c.body(null, 204);
});

// POST /api/customers/:id/documents - upload document
customersRouter.post("/:id/documents", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Customer not found", code: "NOT_FOUND" } }, 404);
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
  console.info(`[uploads] customer_document_saved customerId=${id} file=${fileName}`);

  const doc = await prisma.customerDocument.create({
    data: {
      name,
      url: `/api/uploads/${fileName}`,
      fileName,
      fileType: file.type || null,
      customerId: id,
    },
  });

  return c.json({ data: doc }, 201);
});

// DELETE /api/customers/:id/documents/:docId - delete document
customersRouter.delete("/:id/documents/:docId", async (c) => {
  const docId = c.req.param("docId");

  const doc = await prisma.customerDocument.findUnique({ where: { id: docId } });
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

  await prisma.customerDocument.delete({ where: { id: docId } });

  return c.body(null, 204);
});

export { customersRouter };
