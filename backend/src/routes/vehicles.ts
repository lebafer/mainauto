import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { env } from "../env";
import {
  VehicleCreateSchema,
  VehicleUpdateSchema,
  VehicleCostCreateSchema,
  WorkLogItemCreateSchema,
  WorkLogItemUpdateSchema,
  VehicleBriefExtractFieldsSchema,
  VehicleBriefExtractResponseSchema,
  type VehicleBriefExtractFields,
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
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const BRIEF_MAX_FILES = 4;
const BRIEF_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const OPENAI_PDF_FALLBACK_MODEL = "gpt-4o-mini";
const BRIEF_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isVehicleNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("vehicleNumber");
  }
  return typeof target === "string" && target.includes("vehicleNumber");
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const cleaned = value.replace(/\s+/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeVin(value: unknown): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.length === 17 ? normalized : undefined;
}

function normalizeDate(value: unknown): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const dotMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    return `${year}-${month}-${day}`;
  }

  const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const monthYearMatch = raw.match(/^(\d{2})[./](\d{4})$/);
  if (monthYearMatch) {
    const [, month, year] = monthYearMatch;
    return `${year}-${month}-01`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return undefined;
}

function stripMarkdownCodeBlock(value: string): string {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  return value.trim();
}

function extractOutputText(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === "string" && direct.trim() !== "") {
    return direct;
  }

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return undefined;
  }

  const parts: string[] = [];
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const fragment of content) {
      if (typeof fragment !== "object" || fragment === null) continue;
      const text = (fragment as { text?: unknown }).text;
      if (typeof text === "string" && text.trim() !== "") {
        parts.push(text);
      }
    }
  }

  return parts.length > 0 ? parts.join("\n") : undefined;
}

function normalizeExtractedFields(raw: unknown): { fields: VehicleBriefExtractFields; warnings: string[] } {
  const warnings: string[] = [];
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  const normalized: VehicleBriefExtractFields = {
    vin: normalizeVin(input.vin),
    firstRegistration: normalizeDate(input.firstRegistration),
    color: normalizeString(input.color),
    brand: normalizeString(input.brand),
    model: normalizeString(input.model),
    hsn: normalizeString(input.hsn)?.toUpperCase(),
    tsn: normalizeString(input.tsn)?.toUpperCase(),
    registrationDocNumber: normalizeString(input.registrationDocNumber),
    co2Emission: normalizeNumber(input.co2Emission),
    displacement: (() => {
      const value = normalizeNumber(input.displacement);
      return value === undefined ? undefined : Math.round(value);
    })(),
    power: normalizeNumber(input.power),
    powerKw: normalizeNumber(input.powerKw),
  };

  if (input.vin && !normalized.vin) {
    warnings.push("VIN konnte nicht eindeutig validiert werden.");
  }

  if (input.firstRegistration && !normalized.firstRegistration) {
    warnings.push("Erstzulassung konnte nicht sicher als Datum erkannt werden.");
  }

  if (normalized.power !== undefined && normalized.powerKw === undefined) {
    normalized.powerKw = Math.round(normalized.power / 1.35962);
  } else if (normalized.powerKw !== undefined && normalized.power === undefined) {
    normalized.power = Math.round(normalized.powerKw * 1.35962);
  }

  const fields = VehicleBriefExtractFieldsSchema.parse(normalized);
  return { fields, warnings };
}

function modelSupportsPdfInput(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return (
    normalized === "gpt-4o" ||
    normalized.startsWith("gpt-4o-") ||
    normalized === "gpt-4o-mini" ||
    normalized.startsWith("gpt-4o-mini-") ||
    normalized === "o1" ||
    normalized.startsWith("o1-")
  );
}

function resolveExtractionModel(files: File[]): string {
  const preferredModel = env.OPENAI_MODEL;
  const hasPdf = files.some((file) => file.type === "application/pdf");

  if (!hasPdf || modelSupportsPdfInput(preferredModel)) {
    return preferredModel;
  }

  return OPENAI_PDF_FALLBACK_MODEL;
}

async function extractWithOpenAi(files: File[]): Promise<{ fields: VehicleBriefExtractFields; warnings: string[] }> {
  const model = resolveExtractionModel(files);
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: [
        "Extrahiere Fahrzeugdaten aus den hochgeladenen deutschen Fahrzeugpapieren.",
        "Liefere ausschließlich JSON gemäß Schema.",
        "Wenn ein Wert nicht sicher erkannt wird, lasse das Feld weg.",
        "Nutze für firstRegistration das Format YYYY-MM-DD.",
      ].join(" "),
    },
  ];

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    if (file.type === "application/pdf") {
      content.push({
        type: "input_file",
        filename: file.name || "fahrzeugbrief.pdf",
        file_data: dataUrl,
      });
      continue;
    }

    content.push({
      type: "input_image",
      image_url: dataUrl,
    });
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "vehicle_brief_extract",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              fields: {
                type: "object",
                additionalProperties: false,
                properties: {
                  vin: { type: "string" },
                  firstRegistration: { type: "string" },
                  color: { type: "string" },
                  brand: { type: "string" },
                  model: { type: "string" },
                  hsn: { type: "string" },
                  tsn: { type: "string" },
                  registrationDocNumber: { type: "string" },
                  co2Emission: { type: "number" },
                  displacement: { type: "number" },
                  power: { type: "number" },
                  powerKw: { type: "number" },
                },
                required: [],
              },
              warnings: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["fields", "warnings"],
          },
        },
      },
      max_output_tokens: 700,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`OpenAI error (${response.status}) [model=${model}]: ${errorBody.slice(0, 500)}`);
  }

  const payload = await response.json();
  const rawText = extractOutputText(payload);
  if (!rawText) {
    throw new Error("No extractable output returned by OpenAI.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownCodeBlock(rawText));
  } catch {
    throw new Error("OpenAI response is not valid JSON.");
  }

  const root = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const modelWarnings = Array.isArray(root.warnings)
    ? root.warnings.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
  const modelFields = "fields" in root ? root.fields : root;
  const normalized = normalizeExtractedFields(modelFields);

  return {
    fields: normalized.fields,
    warnings: [...modelWarnings, ...normalized.warnings],
  };
}

// POST /api/vehicles/extract-brief - extract vehicle fields from uploaded brief
vehiclesRouter.post("/extract-brief", async (c) => {
  if (!env.OPENAI_API_KEY) {
    return c.json(
      { error: { message: "OpenAI API key fehlt auf dem Server", code: "OPENAI_NOT_CONFIGURED" } },
      503
    );
  }

  const formData = await c.req.formData();
  const uploaded = [...formData.getAll("files"), ...formData.getAll("files[]")];
  const files = uploaded.filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    return c.json({ error: { message: "Keine Datei hochgeladen", code: "NO_FILE" } }, 400);
  }

  if (files.length > BRIEF_MAX_FILES) {
    return c.json(
      { error: { message: `Maximal ${BRIEF_MAX_FILES} Dateien erlaubt`, code: "TOO_MANY_FILES" } },
      400
    );
  }

  for (const file of files) {
    if (!BRIEF_ALLOWED_MIME_TYPES.has(file.type)) {
      return c.json(
        { error: { message: `Dateityp nicht unterstützt: ${file.type || "unknown"}`, code: "UNSUPPORTED_FILE_TYPE" } },
        400
      );
    }
    if (file.size > BRIEF_MAX_FILE_SIZE_BYTES) {
      return c.json(
        { error: { message: `Datei zu groß: ${file.name}`, code: "FILE_TOO_LARGE" } },
        400
      );
    }
  }

  try {
    const extracted = await extractWithOpenAi(files);
    const detectedFieldCount = Object.values(extracted.fields).filter((value) => value !== undefined).length;
    const response = VehicleBriefExtractResponseSchema.parse({
      fields: extracted.fields,
      warnings: extracted.warnings,
      detectedFieldCount,
    });

    return c.json({ data: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction error";
    console.error("[vehicles] brief_extraction_failed", { message });
    return c.json(
      {
        error: {
          message: "Fahrzeugbrief konnte nicht ausgewertet werden",
          code: "EXTRACTION_FAILED",
        },
      },
      502
    );
  }
});

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
      { vehicleNumber: { contains: search } },
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

// POST /api/vehicles - create vehicle
vehiclesRouter.post(
  "/",
  zValidator("json", VehicleCreateSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Convert power (number) to string for Prisma, strip empty strings
    const firstReg = data.firstRegistration ? new Date(data.firstRegistration) : null;
    const vehicleData = {
      ...data,
      vehicleNumber: data.vehicleNumber.trim(),
      year: data.year ?? (firstReg ? firstReg.getFullYear() : new Date().getFullYear()),
      power: data.power !== undefined ? String(data.power) : undefined,
      vin: data.vin || null,
      hsn: data.hsn || null,
      tsn: data.tsn || null,
      registrationDocNumber: data.registrationDocNumber || null,
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

    try {
      const vehicle = await prisma.vehicle.create({
        data: vehicleData,
        include: {
          images: true,
          customer: true,
        },
      });

      return c.json({ data: vehicle }, 201);
    } catch (error) {
      if (isVehicleNumberConflict(error)) {
        return c.json(
          { error: { message: "Fahrzeugnummer existiert bereits", code: "VEHICLE_NUMBER_CONFLICT" } },
          409
        );
      }
      throw error;
    }
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
      vehicleNumber: data.vehicleNumber !== undefined ? data.vehicleNumber.trim() : undefined,
      power: data.power !== undefined ? String(data.power) : undefined,
      vin: data.vin !== undefined ? (data.vin || null) : undefined,
      hsn: data.hsn !== undefined ? (data.hsn || null) : undefined,
      tsn: data.tsn !== undefined ? (data.tsn || null) : undefined,
      registrationDocNumber: data.registrationDocNumber !== undefined ? (data.registrationDocNumber || null) : undefined,
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

    try {
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
    } catch (error) {
      if (isVehicleNumberConflict(error)) {
        return c.json(
          { error: { message: "Fahrzeugnummer existiert bereits", code: "VEHICLE_NUMBER_CONFLICT" } },
          409
        );
      }
      throw error;
    }
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
