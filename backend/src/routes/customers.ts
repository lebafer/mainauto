import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { CustomerCreateSchema, CustomerUpdateSchema } from "../types";
import { join } from "path";
import { mkdir, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { getCurrentDealerId, requireDealerRole } from "../lib/request-context";
import {
  UploadValidationError,
  isRetentionDocumentType,
  parseStoredDocumentType,
  validateUpload,
} from "../lib/uploads";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "../lib/audit";

const UPLOADS_DIR = join(import.meta.dir, "../../uploads");

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

const customersRouter = new Hono();

// GET /api/customers - list all customers with optional search
customersRouter.get("/", async (c) => {
  const dealerId = getCurrentDealerId(c);
  const search = c.req.query("search");

  const where: Record<string, unknown> = { dealerId };

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
        select: {
          vehicles: true,
          sales: true,
          documents: { where: { softDeletedAt: null } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: customers });
});

// GET /api/customers/:id - get single customer with relations
customersRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const dealerId = getCurrentDealerId(c);

  const customer = await prisma.customer.findFirst({
    where: { id, dealerId },
    include: {
      vehicles: {
        include: { images: true },
        orderBy: { createdAt: "desc" },
      },
      documents: {
        where: { softDeletedAt: null },
        orderBy: { createdAt: "desc" },
      },
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
    const dealerId = getCurrentDealerId(c);
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
      data: {
        dealerId,
        ...createData,
      },
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
    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    const existing = await prisma.customer.findFirst({ where: { id, dealerId } });
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
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) return forbidden;

  const id = c.req.param("id");
  const dealerId = getCurrentDealerId(c);

  const existing = await prisma.customer.findFirst({
    where: { id, dealerId },
    include: {
      documents: true,
      _count: { select: { sales: true } },
    },
  });

  if (!existing) {
    return c.json({ error: { message: "Customer not found", code: "NOT_FOUND" } }, 404);
  }
  if (existing._count.sales > 0) {
    return c.json(
      {
        error: {
          message: "Kunden mit Verkaufshistorie können nicht gelöscht werden",
          code: "CUSTOMER_HAS_SALES",
        },
      },
      409
    );
  }
  if (existing.documents.some((document) => document.retentionLocked)) {
    await writeAuditLog(c, {
      action: "customer.deletion_blocked_retention",
      entityType: "Customer",
      entityId: id,
    });
    return c.json(
      {
        error: {
          message:
            "Kunden mit aufbewahrungspflichtigen Dokumenten können nicht gelöscht werden",
          code: "CUSTOMER_HAS_RETAINED_DOCUMENTS",
        },
      },
      409
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.customer.delete({ where: { id } });
      await writeAuditLog(
        c,
        {
          action: "customer.deleted",
          entityType: "Customer",
          entityId: id,
        },
        tx
      );
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return c.json(
        {
          error: {
            message: "Kunden mit Verkaufshistorie können nicht gelöscht werden",
            code: "CUSTOMER_HAS_SALES",
          },
        },
        409
      );
    }
    throw error;
  }

  // Remove physical files only after the database deletion has committed.
  for (const doc of existing.documents) {
    const filePath = join(UPLOADS_DIR, doc.fileName);
    try {
      await unlink(filePath);
    } catch {
      // File may already be deleted
    }
  }

  return c.body(null, 204);
});

// POST /api/customers/:id/documents - upload document
customersRouter.post("/:id/documents", async (c) => {
  const id = c.req.param("id");
  const dealerId = getCurrentDealerId(c);

  const existing = await prisma.customer.findFirst({ where: { id, dealerId } });
  if (!existing) {
    return c.json({ error: { message: "Customer not found", code: "NOT_FOUND" } }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const name = String(formData.get("name") || file?.name || "Untitled").slice(0, 240);
  const documentType = parseStoredDocumentType(formData.get("documentType"));

  if (!file) {
    return c.json({ error: { message: "No file provided", code: "BAD_REQUEST" } }, 400);
  }

  let validated;
  try {
    validated = await validateUpload(file, {
      kind: "document",
      maxBytes: 20 * 1024 * 1024,
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return c.json({ error: { message: error.message, code: error.code } }, 400);
    }
    throw error;
  }
  const fileName = `${randomUUID()}.${validated.extension}`;
  const filePath = join(UPLOADS_DIR, fileName);

  const arrayBuffer = await file.arrayBuffer();
  await Bun.write(filePath, arrayBuffer);
  console.info(`[uploads] customer_document_saved customerId=${id} file=${fileName}`);

  let doc;
  try {
    doc = await prisma.customerDocument.create({
      data: {
        dealerId,
        name,
        url: `/api/uploads/${fileName}`,
        fileName,
        fileType: validated.contentType,
        documentType,
        retentionLocked: isRetentionDocumentType(documentType),
        customerId: id,
      },
    });
  } catch (error) {
    await unlink(filePath).catch(() => undefined);
    throw error;
  }

  return c.json({ data: doc }, 201);
});

// DELETE /api/customers/:id/documents/:docId - delete document
customersRouter.delete("/:id/documents/:docId", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) return forbidden;

  const docId = c.req.param("docId");
  const dealerId = getCurrentDealerId(c);

  const customerId = c.req.param("id");
  const doc = await prisma.customerDocument.findFirst({
    where: { id: docId, customerId, dealerId, softDeletedAt: null },
  });
  if (!doc) {
    return c.json({ error: { message: "Document not found", code: "NOT_FOUND" } }, 404);
  }

  if (doc.retentionLocked) {
    await prisma.$transaction(async (tx) => {
      await tx.customerDocument.update({
        where: { id: docId },
        data: { softDeletedAt: new Date() },
      });
      await writeAuditLog(
        c,
        {
          action: "customer_document.soft_deleted",
          entityType: "CustomerDocument",
          entityId: docId,
          metadata: { documentType: doc.documentType },
        },
        tx
      );
    });
    return c.body(null, 204);
  }

  await prisma.$transaction(async (tx) => {
    await tx.customerDocument.delete({ where: { id: docId } });
    await writeAuditLog(
      c,
      {
        action: "customer_document.deleted",
        entityType: "CustomerDocument",
        entityId: docId,
        metadata: { documentType: doc.documentType },
      },
      tx
    );
  });

  const filePath = join(UPLOADS_DIR, doc.fileName);
  try {
    await unlink(filePath);
  } catch {
    // File may already be deleted
  }

  return c.body(null, 204);
});

export { customersRouter };
