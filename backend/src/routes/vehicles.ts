import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { env } from "../env";
import {
  HandoverProtocolSchema,
  VehicleCreateSchema,
  VehicleUpdateSchema,
  VehicleCostCreateSchema,
  WorkLogItemCreateSchema,
  WorkLogItemUpdateSchema,
  VehicleBriefDocumentTypeSchema,
  VehicleBriefExtractFieldsSchema,
  VehicleBriefExtractResponseSchema,
  type VehicleBriefDocumentType,
  type VehicleBriefExtractFields,
} from "../types";
import { buildDefaultHandoverProtocol } from "../lib/handoverProtocol";
import { join } from "path";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { getCurrentDealer, getCurrentDealerId, getCurrentEntitlements, requireEntitlement } from "../lib/request-context";
import {
  enqueueAndRunMarketplaceJob,
  upsertVehicleMarketplaceTargets,
} from "../lib/marketplace-sync";

const UPLOADS_DIR = join(import.meta.dir, "../../uploads");

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

const vehiclesRouter = new Hono();
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const BRIEF_MAX_FILES = 4;
const BRIEF_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const OPENAI_DEFAULT_EXTRACTION_MODEL = "gpt-4o";
const OPENAI_PDF_FALLBACK_MODEL = "gpt-4o";
const BRIEF_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const execFileAsync = promisify(execFile);
const vehicleImageOrderBy = [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }];

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
  if (trimmed === "" || trimmed.toUpperCase() === "NULL") return undefined;
  return trimmed;
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

function normalizeHsn(value: unknown): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^\d{4}$/.test(normalized) ? normalized : undefined;
}

function normalizeTsn(value: unknown): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length < 3) {
    return undefined;
  }
  return normalized.slice(0, 3);
}

function normalizeRegistrationDocNumber(value: unknown): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  if (raw.includes("/")) return undefined;
  const normalized = raw.toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9]{4,20}$/.test(normalized) ? normalized : undefined;
}

function normalizeDocumentType(value: unknown): VehicleBriefDocumentType {
  const raw = normalizeString(value)?.toLowerCase();
  if (!raw) return "unknown";
  if (raw.includes("teil 1") || raw.includes("teil1") || raw.includes("fahrzeugschein")) return "teil1";
  if (raw.includes("teil 2") || raw.includes("teil2") || raw.includes("fahrzeugbrief")) return "teil2";
  if (raw.includes("mixed") || raw.includes("beide") || raw.includes("mehrere")) return "mixed";
  return "unknown";
}

function normalizeFuelType(value: unknown): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  if (
    normalized.includes("elektro") ||
    normalized.includes("electric") ||
    normalized.includes("strom") ||
    normalized.includes("bev")
  ) {
    return "Elektro";
  }

  if (normalized.includes("diesel")) {
    return "Diesel";
  }

  if (normalized.includes("benzin") || normalized.includes("petrol")) {
    return "Benzin";
  }

  if (
    normalized.includes("hybrid") ||
    normalized.includes("plug-in") ||
    normalized.includes("plugin")
  ) {
    return "Hybrid";
  }

  if (normalized.includes("gas") || normalized.includes("cng") || normalized.includes("lpg")) {
    return "Gas";
  }

  return raw;
}

function normalizeBodyType(value: unknown): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  if (normalized.includes("suv") || normalized.includes("geländ")) return "SUV";
  if (normalized.includes("kombi")) return "Kombi";
  if (normalized.includes("limousine") || normalized.includes("schr")) return "Limousine";
  if (normalized.includes("coup")) return "Coupé";
  if (normalized.includes("cabrio") || normalized.includes("roadster")) return "Cabrio";
  if (normalized.includes("van") || normalized.includes("minivan") || normalized.includes("bus")) return "Van/Minivan";
  if (normalized.includes("transporter") || normalized.includes("kasten")) return "Transporter";
  if (normalized.includes("pickup") || normalized.includes("pick-up")) return "Pickup";

  return raw;
}

function normalizeDriveType(value: unknown): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  if (normalized.includes("allrad") || normalized.includes("awd")) return "AWD";
  if (normalized.includes("4x4")) return "4x4";
  if (normalized.includes("front") || normalized.includes("fwd") || normalized.includes("vorderrad")) return "FWD";
  if (normalized.includes("heck") || normalized.includes("rwd") || normalized.includes("hinterrad")) return "RWD";

  return undefined;
}

function normalizeEmissionClass(value: unknown): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;

  const normalized = raw.toLowerCase().replace(/\s+/g, "");
  const euroMatch = normalized.match(/euro(\d)(d-temp|dtemp|d)?/);

  if (!euroMatch) {
    return raw;
  }

  const [, level, suffix] = euroMatch;
  if (!suffix) return `Euro ${level}`;
  if (suffix === "d") return `Euro ${level}d`;
  return `Euro ${level}d-TEMP`;
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

function normalizeTeil1PowerKw(value: unknown): number | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  const match = raw.match(/(\d+(?:[.,]\d+)?)(?=\s*\/|$)/);
  if (!match) return normalizeNumber(raw);
  return normalizeNumber(match[1]);
}

function normalizeTeil1SourceFields(raw: unknown): Record<string, string | undefined> {
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  return {
    fieldB: normalizeString(input.fieldB),
    fieldE: normalizeString(input.fieldE),
    fieldD1: normalizeString(input.fieldD1),
    fieldD3: normalizeString(input.fieldD3),
    fieldJ: normalizeString(input.fieldJ),
    field5: normalizeString(input.field5),
    fieldP1: normalizeString(input.fieldP1),
    fieldP2: normalizeString(input.fieldP2),
    fieldP3: normalizeString(input.fieldP3),
    fieldR: normalizeString(input.fieldR),
    fieldV7: normalizeString(input.fieldV7),
    fieldV9: normalizeString(input.fieldV9),
    field21: normalizeString(input.field21),
    field22: normalizeString(input.field22),
  };
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

function normalizeExtractedFields(raw: unknown, explicitDocumentType?: unknown): {
  documentType: VehicleBriefDocumentType;
  fields: VehicleBriefExtractFields;
  warnings: string[];
} {
  const warnings: string[] = [];
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const documentType = VehicleBriefDocumentTypeSchema.parse(
    normalizeDocumentType(explicitDocumentType ?? input.documentType)
  );
  const teil1Fields = normalizeTeil1SourceFields(input.sourceFields);

  const normalized: VehicleBriefExtractFields = {
    vin: normalizeVin(documentType === "teil1" ? teil1Fields.fieldE ?? input.vin : input.vin),
    firstRegistration: normalizeDate(
      documentType === "teil1" ? teil1Fields.fieldB ?? input.firstRegistration : input.firstRegistration
    ),
    color: normalizeString(documentType === "teil1" ? teil1Fields.fieldR ?? input.color : input.color),
    brand: normalizeString(documentType === "teil1" ? teil1Fields.fieldD1 ?? input.brand : input.brand),
    model: normalizeString(documentType === "teil1" ? teil1Fields.fieldD3 ?? input.model : input.model),
    hsn: normalizeHsn(documentType === "teil1" ? teil1Fields.field21 ?? input.hsn : input.hsn),
    tsn: normalizeTsn(documentType === "teil1" ? teil1Fields.field22 ?? input.tsn : input.tsn),
    registrationDocNumber: normalizeRegistrationDocNumber(input.registrationDocNumber),
    fuelType: normalizeFuelType(documentType === "teil1" ? teil1Fields.fieldP3 ?? input.fuelType : input.fuelType),
    co2Emission: normalizeNumber(documentType === "teil1" ? teil1Fields.fieldV7 ?? input.co2Emission : input.co2Emission),
    displacement: (() => {
      const value = documentType === "teil1"
        ? normalizeNumber(teil1Fields.fieldP1 ?? input.displacement)
        : normalizeNumber(input.displacement);
      return value === undefined ? undefined : Math.round(value);
    })(),
    power: documentType === "teil1" ? undefined : normalizeNumber(input.power),
    powerKw: documentType === "teil1"
      ? normalizeTeil1PowerKw(teil1Fields.fieldP2 ?? input.powerKw)
      : normalizeNumber(input.powerKw),
    bodyType: normalizeBodyType(documentType === "teil1" ? teil1Fields.field5 ?? input.bodyType : input.bodyType),
    driveType: normalizeDriveType(input.driveType),
    emissionClass: normalizeEmissionClass(
      documentType === "teil1" ? teil1Fields.fieldV9 ?? input.emissionClass : input.emissionClass
    ),
    previousOwners: (() => {
      const value = normalizeNumber(input.previousOwners);
      return value === undefined ? undefined : Math.round(value);
    })(),
  };

  const rawVin = documentType === "teil1" ? teil1Fields.fieldE ?? input.vin : input.vin;
  const rawHsn = documentType === "teil1" ? teil1Fields.field21 ?? input.hsn : input.hsn;
  const rawTsn = documentType === "teil1" ? teil1Fields.field22 ?? input.tsn : input.tsn;
  const rawFirstRegistration =
    documentType === "teil1" ? teil1Fields.fieldB ?? input.firstRegistration : input.firstRegistration;

  if (rawVin && !normalized.vin) {
    warnings.push("VIN konnte nicht eindeutig validiert werden.");
  }

  if (rawHsn && !normalized.hsn) {
    warnings.push("HSN konnte nicht sicher erkannt werden.");
  }

  if (rawTsn && !normalized.tsn) {
    warnings.push("TSN konnte nicht sicher erkannt werden.");
  }

  if (rawFirstRegistration && !normalized.firstRegistration) {
    warnings.push("Erstzulassung konnte nicht sicher als Datum erkannt werden.");
  }

  if (input.registrationDocNumber && !normalized.registrationDocNumber) {
    warnings.push("Fahrzeugbriefnummer konnte nicht sicher erkannt werden.");
  }

  if (documentType === "teil1" && normalized.registrationDocNumber) {
    normalized.registrationDocNumber = undefined;
    warnings.push("Zulassungsbescheinigung Teil I erkannt: Fahrzeugbriefnummer wurde nicht übernommen.");
  }

  if (normalized.power !== undefined && normalized.powerKw === undefined) {
    normalized.powerKw = Math.round(normalized.power / 1.35962);
  } else if (normalized.powerKw !== undefined && normalized.power === undefined) {
    normalized.power = Math.round(normalized.powerKw * 1.35962);
  }

  const fields = VehicleBriefExtractFieldsSchema.parse(normalized);
  return { documentType, fields, warnings };
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
  const preferredModel = env.OPENAI_EXTRACTION_MODEL || env.OPENAI_MODEL || OPENAI_DEFAULT_EXTRACTION_MODEL;
  const hasPdf = files.some((file) => file.type === "application/pdf");

  if (!hasPdf || modelSupportsPdfInput(preferredModel)) {
    return preferredModel;
  }

  return OPENAI_PDF_FALLBACK_MODEL;
}

const VEHICLE_BRIEF_FIELD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    vin: { type: ["string", "null"] },
    firstRegistration: { type: ["string", "null"] },
    color: { type: ["string", "null"] },
    brand: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    hsn: { type: ["string", "null"] },
    tsn: { type: ["string", "null"] },
    registrationDocNumber: { type: ["string", "null"] },
    fuelType: { type: ["string", "null"] },
    co2Emission: { type: ["number", "null"] },
    displacement: { type: ["number", "null"] },
    power: { type: ["number", "null"] },
    powerKw: { type: ["number", "null"] },
    bodyType: { type: ["string", "null"] },
    driveType: { type: ["string", "null"] },
    emissionClass: { type: ["string", "null"] },
    previousOwners: { type: ["number", "null"] },
  },
  required: [
    "vin",
    "firstRegistration",
    "color",
    "brand",
    "model",
    "hsn",
    "tsn",
    "registrationDocNumber",
    "fuelType",
    "co2Emission",
    "displacement",
    "power",
    "powerKw",
    "bodyType",
    "driveType",
    "emissionClass",
    "previousOwners",
  ],
} as const;

const VEHICLE_TEIL1_SOURCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    fieldB: { type: ["string", "null"] },
    fieldE: { type: ["string", "null"] },
    fieldD1: { type: ["string", "null"] },
    fieldD3: { type: ["string", "null"] },
    fieldJ: { type: ["string", "null"] },
    field5: { type: ["string", "null"] },
    fieldP1: { type: ["string", "null"] },
    fieldP2: { type: ["string", "null"] },
    fieldP3: { type: ["string", "null"] },
    fieldR: { type: ["string", "null"] },
    fieldV7: { type: ["string", "null"] },
    fieldV9: { type: ["string", "null"] },
    field21: { type: ["string", "null"] },
    field22: { type: ["string", "null"] },
  },
  required: [
    "fieldB",
    "fieldE",
    "fieldD1",
    "fieldD3",
    "fieldJ",
    "field5",
    "fieldP1",
    "fieldP2",
    "fieldP3",
    "fieldR",
    "fieldV7",
    "fieldV9",
    "field21",
    "field22",
  ],
} as const;

async function buildOpenAiInputContent(files: File[]): Promise<Array<Record<string, unknown>>> {
  const content: Array<Record<string, unknown>> = [];

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    if (file.type === "application/pdf") {
      content.push({
        type: "input_file",
        filename: file.name || "fahrzeugpapier.pdf",
        file_data: dataUrl,
      });
      continue;
    }

    content.push({
      type: "input_image",
      image_url: dataUrl,
    });
  }

  return content;
}

async function runOpenAiStructuredRequest(
  model: string,
  contentItems: Array<Record<string, unknown>>,
  schemaName: string,
  schema: Record<string, unknown>,
  instructions: string[],
  maxOutputTokens = 700
): Promise<Record<string, unknown>> {
  const content = [
    {
      type: "input_text",
      text: instructions.join(" "),
    },
    ...contentItems,
  ];

  const requestBody = {
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
        name: schemaName,
        strict: true,
        schema,
      },
    },
    max_output_tokens: maxOutputTokens,
  };

  const tempDir = await mkdtemp(join(tmpdir(), "mainauto-openai-"));
  const payloadPath = join(tempDir, "request.json");

  let stdout = "";
  let stderr = "";

  try {
    await writeFile(payloadPath, JSON.stringify(requestBody), "utf8");
    ({ stdout, stderr } = await execFileAsync("curl", [
      "-sS",
      "-X",
      "POST",
      OPENAI_RESPONSES_URL,
      "-H",
      `Authorization: Bearer ${env.OPENAI_API_KEY}`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      `@${payloadPath}`,
      "-w",
      "\n%{http_code}",
    ]));
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }

  const lastNewline = stdout.lastIndexOf("\n");
  if (lastNewline === -1) {
    throw new Error(`OpenAI transport error [model=${model}]: malformed curl response ${stderr.slice(0, 300)}`);
  }

  const responseBody = stdout.slice(0, lastNewline);
  const status = Number(stdout.slice(lastNewline + 1).trim());

  if (!Number.isFinite(status)) {
    throw new Error(`OpenAI transport error [model=${model}]: invalid status code ${stderr.slice(0, 300)}`);
  }

  if (status < 200 || status >= 300) {
    throw new Error(`OpenAI error (${status}) [model=${model}]: ${responseBody.slice(0, 500)}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseBody);
  } catch {
    throw new Error(`OpenAI transport error [model=${model}]: response is not valid JSON`);
  }

  const rawText = extractOutputText(payload);
  if (!rawText) {
    throw new Error("No extractable output returned by OpenAI.");
  }

  try {
    const parsed = JSON.parse(stripMarkdownCodeBlock(rawText));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error("OpenAI response is not valid JSON.");
  }
}

async function extractWithOpenAi(files: File[]): Promise<{
  documentType: VehicleBriefDocumentType;
  fields: VehicleBriefExtractFields;
  warnings: string[];
}> {
  const model = resolveExtractionModel(files);
  const baseContent = await buildOpenAiInputContent(files);
  const root = await runOpenAiStructuredRequest(
    model,
    baseContent,
    "vehicle_brief_extract",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        documentType: {
          type: "string",
          enum: ["teil1", "teil2", "mixed", "unknown"],
        },
        fields: VEHICLE_BRIEF_FIELD_SCHEMA,
        sourceFields: {
          anyOf: [
            VEHICLE_TEIL1_SOURCE_SCHEMA,
            { type: "null" },
          ],
        },
        warnings: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["documentType", "fields", "sourceFields", "warnings"],
    },
    [
      "Extrahiere Fahrzeugdaten aus den hochgeladenen deutschen Fahrzeugpapieren.",
      "Liefere ausschließlich JSON gemäß Schema.",
      "Wenn ein Wert nicht sicher erkannt wird, lasse das Feld weg.",
      "Gib niemals den String 'NULL' zurück, sondern JSON null.",
      "Erkenne zuerst den Dokumenttyp und setze documentType auf teil1, teil2, mixed oder unknown.",
      "teil1 bedeutet Zulassungsbescheinigung Teil I beziehungsweise Fahrzeugschein.",
      "teil2 bedeutet Zulassungsbescheinigung Teil II beziehungsweise Fahrzeugbrief.",
      "Nutze für firstRegistration das Format YYYY-MM-DD.",
      "fuelType soll auf Benzin, Diesel, Elektro, Hybrid oder Gas normalisiert werden.",
      "powerKw ist die Nennleistung in kW, z.B. aus Feld P.2 oder aus 'Nennleistung'.",
      "power ist Leistung in PS und nur dann zu befüllen, wenn PS explizit angegeben sind; falls nur kW vorhanden sind, power leer lassen.",
      "co2Emission ist der CO2-Ausstoß in g/km; bei Elektrofahrzeugen mit 0 g/km gib 0 zurück.",
      "bodyType ist die Karosserieform und soll auf Limousine, Kombi, SUV, Coupé, Cabrio, Van/Minivan, Transporter oder Pickup normalisiert werden.",
      "driveType ist der Antrieb und soll nur befüllt werden, wenn er klar erkennbar ist; normalisiere auf FWD, RWD, AWD oder 4x4.",
      "emissionClass ist die Schadstoffklasse und soll z.B. als Euro 6 oder Euro 6d-TEMP zurückgegeben werden.",
      "previousOwners ist die Anzahl der Vorbesitzer/Halter als Zahl und nur zu befüllen, wenn sie explizit im Dokument steht.",
      "Für Teil I gelten insbesondere diese Felder: B = Erstzulassung, 2.1 = HSN, 2.2 = TSN, E = VIN, D.1 = Marke, D.3 = Modell, J = Fahrzeugklasse oder Aufbauart, P.1 = Hubraum, P.2 = Leistung in kW, P.3 = Kraftstoffart, R = Farbe, V.7 = CO2, V.9 = Emissionsklasse.",
      "Gib für Teil I zusätzlich sourceFields mit den exakt abgelesenen Werten aus B, E, D.1, D.3, J, Feld 5 oder Aufbauart, P.1, P.2, P.3, R, V.7, V.9, 2.1 und 2.2 zurück.",
      "2.1 ist nur die vierstellige HSN. 2.2 ist nur die TSN rechts daneben. D.2 oder D.2.1 sind niemals HSN oder TSN.",
      "P.2 ist nur die kW-Angabe vor dem Schrägstrich. P.4 ist PS. Werte aus 7.1, 7.2, 8.1, 8.2, T oder ähnlichen Feldern dürfen niemals als Leistung oder Hubraum verwendet werden.",
      "Wenn auf Teil I bei P.4 kein PS-Wert steht, lasse power leer. power wird später aus powerKw berechnet.",
      "Verwende bei Teil I niemals die oben links stehende Nummer 'Nr.' als registrationDocNumber.",
      "Wenn nur Teil I vorliegt, lasse registrationDocNumber leer.",
      "Kennzeichen, Halterdaten, lokale Aktennummern und sonstige Dokumentnummern dürfen niemals als VIN, HSN, TSN oder registrationDocNumber verwendet werden.",
    ],
    700
  );
  const modelWarnings = Array.isArray(root.warnings)
    ? root.warnings.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
  const modelFields = "fields" in root ? root.fields : root;
  const modelFieldPayload =
    typeof modelFields === "object" && modelFields !== null
      ? {
          ...(modelFields as Record<string, unknown>),
          sourceFields: "sourceFields" in root ? root.sourceFields : undefined,
        }
      : modelFields;
  const normalized = normalizeExtractedFields(
    modelFieldPayload,
    "documentType" in root ? root.documentType : undefined
  );

  return {
    documentType:
      "documentType" in root
        ? VehicleBriefDocumentTypeSchema.parse(normalizeDocumentType(root.documentType))
        : normalized.documentType,
    fields: normalized.fields,
    warnings: [...modelWarnings, ...normalized.warnings],
  };
}

// POST /api/vehicles/extract-brief - extract vehicle fields from uploaded brief
vehiclesRouter.post("/extract-brief", async (c) => {
  const forbidden = requireEntitlement(c, "ai_brief_extraction");
  if (forbidden) {
    return forbidden;
  }

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
      documentType: extracted.documentType,
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
          message: "Fahrzeugpapiere konnten nicht ausgewertet werden",
          code: "EXTRACTION_FAILED",
        },
      },
      502
    );
  }
});

// GET /api/vehicles - list all vehicles with optional filters
vehiclesRouter.get("/", async (c) => {
  const dealerId = getCurrentDealerId(c);
  const privateVehiclesEnabled = getCurrentEntitlements(c).private_vehicles === true;
  const status = c.req.query("status");
  const search = c.req.query("search");
  const isPrivate = c.req.query("isPrivate");

  const where: Record<string, unknown> = { dealerId };

  if (status) {
    where.status = status;
  }

  if (privateVehiclesEnabled && isPrivate === "true") {
    where.isPrivate = true;
  } else if (privateVehiclesEnabled && isPrivate === "false") {
    where.isPrivate = false;
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
      images: { orderBy: vehicleImageOrderBy },
      customer: true,
      supplierRel: true,
      marketplaceTargets: true,
      _count: {
        select: { sales: true, documents: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!privateVehiclesEnabled) {
    return c.json({
      data: vehicles.map((vehicle) => ({
        ...vehicle,
        isPrivate: false,
      })),
    });
  }

  return c.json({ data: vehicles });
});

// GET /api/vehicles/:id - get single vehicle with relations
vehiclesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const dealerId = getCurrentDealerId(c);
  const privateVehiclesEnabled = getCurrentEntitlements(c).private_vehicles === true;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, dealerId },
    include: {
      images: { orderBy: vehicleImageOrderBy },
      documents: { orderBy: { createdAt: "desc" } },
      customer: true,
      supplierRel: true,
      marketplaceTargets: true,
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

  if (!privateVehiclesEnabled) {
    return c.json({
      data: {
        ...vehicle,
        isPrivate: false,
      },
    });
  }

  return c.json({ data: vehicle });
});

// GET /api/vehicles/:id/handover-protocol - get saved handover protocol or defaults
vehiclesRouter.get("/:id/handover-protocol", async (c) => {
  const id = c.req.param("id");
  const dealerId = getCurrentDealerId(c);
  const dealer = getCurrentDealer(c);
  const settings = dealer.settings as {
    legalName?: string | null;
    addressLine1?: string | null;
    zip?: string | null;
    city?: string | null;
    website?: string | null;
    email?: string | null;
    phone?: string | null;
    taxId?: string | null;
    legalRepresentative?: string | null;
    bankName?: string | null;
    iban?: string | null;
    bic?: string | null;
    logoUrl?: string | null;
  } | null | undefined;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, dealerId },
    include: {
      customer: true,
      handoverProtocol: true,
    },
  });

  if (!vehicle) {
    return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
  }

  const defaults = buildDefaultHandoverProtocol(vehicle, vehicle.customer, {
    name: settings?.legalName || dealer.name,
    addressLine1: settings?.addressLine1 || "",
    cityLine: [settings?.zip, settings?.city].filter(Boolean).join(" "),
    website: settings?.website || "",
    email: settings?.email || "",
    phone: settings?.phone || "",
    taxId: settings?.taxId || "",
    legalRepresentative: settings?.legalRepresentative || "",
    bankName: settings?.bankName || "",
    iban: settings?.iban || "",
    bic: settings?.bic || "",
    logoUrl: settings?.logoUrl || null,
  });
  const parsedStored = vehicle.handoverProtocol
    ? HandoverProtocolSchema.parse(vehicle.handoverProtocol.data)
    : null;

  return c.json({
    data: {
      exists: !!vehicle.handoverProtocol,
      updatedAt: vehicle.handoverProtocol?.updatedAt.toISOString() ?? null,
      data: parsedStored ?? defaults,
    },
  });
});

// PUT /api/vehicles/:id/handover-protocol - upsert handover protocol
vehiclesRouter.put(
  "/:id/handover-protocol",
  zValidator("json", HandoverProtocolSchema),
  async (c) => {
    const id = c.req.param("id");
    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    const vehicle = await prisma.vehicle.findFirst({ where: { id, dealerId } });
    if (!vehicle) {
      return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
    }

    const handoverProtocol = await prisma.vehicleHandoverProtocol.upsert({
      where: { vehicleId: id },
      create: {
        dealerId,
        vehicleId: id,
        data,
      },
      update: {
        data,
      },
    });

    return c.json({
      data: {
        exists: true,
        updatedAt: handoverProtocol.updatedAt.toISOString(),
        data: HandoverProtocolSchema.parse(handoverProtocol.data),
      },
    });
  }
);

// POST /api/vehicles - create vehicle
vehiclesRouter.post(
  "/",
  zValidator("json", VehicleCreateSchema),
  async (c) => {
    const dealerId = getCurrentDealerId(c);
    const privateVehiclesEnabled = getCurrentEntitlements(c).private_vehicles === true;
    const data = c.req.valid("json");
    const {
      marketplaceTargets = [],
      queueUploadNow = false,
      ...input
    } = data;

    if (input.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, dealerId },
      });
      if (!customer) {
        return c.json({ error: { message: "Customer not found", code: "NOT_FOUND" } }, 404);
      }
    }

    if (input.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: input.supplierId, dealerId },
      });
      if (!supplier) {
        return c.json({ error: { message: "Supplier not found", code: "NOT_FOUND" } }, 404);
      }
    }

    // Convert power (number) to string for Prisma, strip empty strings
    const firstReg = input.firstRegistration ? new Date(input.firstRegistration) : null;
    const isPrivateVehicle = privateVehiclesEnabled && input.isPrivate === true;
    const vehicleData = {
      ...input,
      vehicleNumber: input.vehicleNumber.trim(),
      year: input.year ?? (firstReg ? firstReg.getFullYear() : new Date().getFullYear()),
      power: input.power !== undefined ? String(input.power) : undefined,
      vin: input.vin || null,
      hsn: input.hsn || null,
      tsn: input.tsn || null,
      registrationDocNumber: input.registrationDocNumber || null,
      color: input.color || null,
      fuelType: input.fuelType || null,
      transmission: input.transmission || null,
      sellingPrice: isPrivateVehicle ? 0 : input.sellingPrice,
      taxRate: isPrivateVehicle ? 19 : input.taxRate,
      marginTaxed: isPrivateVehicle ? false : input.marginTaxed,
      isPrivate: input.isPrivate,
      status: isPrivateVehicle ? "available" : input.status,
      notes: input.notes || null,
      internalNotes: input.internalNotes || null,
      customerId: isPrivateVehicle ? null : input.customerId || null,
      features: input.features || null,
      // New nullable string/number fields
      damageDescription: input.damageDescription || null,
      batteryType: input.batteryType || null,
      co2Emission: input.co2Emission ?? null,
      displacement: input.displacement ?? null,
      powerKw: input.powerKw ?? null,
      damageAmount: input.damageAmount ?? null,
      batteryCapacity: input.batteryCapacity ?? null,
      electricRange: input.electricRange ?? null,
      batterySoh: input.batterySoh ?? null,
      transportCostDomestic: isPrivateVehicle ? null : input.transportCostDomestic ?? null,
      transportCostAbroad: isPrivateVehicle ? null : input.transportCostAbroad ?? null,
      customsDuties: isPrivateVehicle ? null : input.customsDuties ?? null,
      registrationFees: isPrivateVehicle ? null : input.registrationFees ?? null,
      repairCostsAbroad: isPrivateVehicle ? null : input.repairCostsAbroad ?? null,
      // Additional fields
      firstRegistration: input.firstRegistration ? new Date(input.firstRegistration) : null,
      supplier: input.supplier || null,
      chargingTime: input.chargingTime ?? null,
      connectorType: input.connectorType || null,
      // Supplier relation
      supplierId: input.supplierId ?? null,
      // Inspection / Service
      huDue: input.huDue ? new Date(input.huDue) : null,
      previousOwners: input.previousOwners ?? null,
      serviceDueKm: input.serviceDueKm ?? null,
      serviceDueDate: input.serviceDueDate ? new Date(input.serviceDueDate) : null,
      // Body / Configuration
      bodyType: input.bodyType || null,
      doors: input.doors ?? null,
      seats: input.seats ?? null,
      driveType: input.driveType || null,
      emissionClass: input.emissionClass || null,
      exportEnabled: isPrivateVehicle ? false : input.exportEnabled,
      dealerPrice: isPrivateVehicle ? null : input.dealerPrice ?? null,
    };

    try {
      const vehicle = await prisma.vehicle.create({
        data: {
          dealerId,
          ...vehicleData,
        },
        include: {
          images: true,
          customer: true,
          marketplaceTargets: true,
        },
      });

      if (marketplaceTargets.length > 0) {
        await upsertVehicleMarketplaceTargets(
          dealerId,
          vehicle.id,
          marketplaceTargets.map((item) => ({
            ...item,
            enabled: isPrivateVehicle ? false : item.enabled,
          }))
        );
      }

      if (queueUploadNow && !isPrivateVehicle) {
        const autoscoutEnabled = marketplaceTargets.some(
          (item) => item.platform === "autoscout24" && item.enabled
        );
        if (autoscoutEnabled) {
          await enqueueAndRunMarketplaceJob({
            dealerId,
            platform: "autoscout24",
            vehicleId: vehicle.id,
            triggerType: "vehicle_create",
            action: "sync",
          });
        }
      }

      const refreshedVehicle = await prisma.vehicle.findUnique({
        where: { id: vehicle.id },
        include: {
          images: true,
          customer: true,
          marketplaceTargets: true,
        },
      });

      return c.json({ data: refreshedVehicle ?? vehicle }, 201);
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
    const dealerId = getCurrentDealerId(c);
    const privateVehiclesEnabled = getCurrentEntitlements(c).private_vehicles === true;
    const data = c.req.valid("json");
    const {
      marketplaceTargets,
      queueUploadNow = false,
      ...input
    } = data;

    const existing = await prisma.vehicle.findFirst({ where: { id, dealerId } });
    if (!existing) {
      return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
    }

    if (input.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, dealerId },
      });
      if (!customer) {
        return c.json({ error: { message: "Customer not found", code: "NOT_FOUND" } }, 404);
      }
    }

    if (input.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: input.supplierId, dealerId },
      });
      if (!supplier) {
        return c.json({ error: { message: "Supplier not found", code: "NOT_FOUND" } }, 404);
      }
    }

    // Handle nullable customerId: convert null to disconnect
    const isPrivateVehicle = privateVehiclesEnabled && input.isPrivate === true;
    const updateData: Record<string, unknown> = {
      ...input,
      vehicleNumber: input.vehicleNumber !== undefined ? input.vehicleNumber.trim() : undefined,
      power: input.power !== undefined ? String(input.power) : undefined,
      vin: input.vin !== undefined ? (input.vin || null) : undefined,
      hsn: input.hsn !== undefined ? (input.hsn || null) : undefined,
      tsn: input.tsn !== undefined ? (input.tsn || null) : undefined,
      registrationDocNumber: input.registrationDocNumber !== undefined ? (input.registrationDocNumber || null) : undefined,
      color: input.color !== undefined ? (input.color || null) : undefined,
      fuelType: input.fuelType !== undefined ? (input.fuelType || null) : undefined,
      transmission: input.transmission !== undefined ? (input.transmission || null) : undefined,
      sellingPrice: isPrivateVehicle ? 0 : input.sellingPrice,
      taxRate: isPrivateVehicle ? 19 : input.taxRate,
      marginTaxed: isPrivateVehicle ? false : input.marginTaxed,
      isPrivate: input.isPrivate,
      status: isPrivateVehicle ? "available" : input.status,
      notes: input.notes !== undefined ? (input.notes || null) : undefined,
      internalNotes: input.internalNotes !== undefined ? (input.internalNotes || null) : undefined,
      customerId: isPrivateVehicle
        ? null
        : input.customerId !== undefined
          ? (input.customerId || null)
          : undefined,
      // New nullable string fields
      damageDescription: input.damageDescription !== undefined ? (input.damageDescription || null) : undefined,
      batteryType: input.batteryType !== undefined ? (input.batteryType || null) : undefined,
      // Additional new fields
      firstRegistration: input.firstRegistration !== undefined ? (input.firstRegistration ? new Date(input.firstRegistration) : null) : undefined,
      supplier: input.supplier !== undefined ? (input.supplier || null) : undefined,
      chargingTime: input.chargingTime !== undefined ? (input.chargingTime ?? null) : undefined,
      connectorType: input.connectorType !== undefined ? (input.connectorType || null) : undefined,
      // Supplier relation
      supplierId: input.supplierId !== undefined ? (input.supplierId ?? null) : undefined,
      // Inspection / Service
      huDue: input.huDue !== undefined ? (input.huDue ? new Date(input.huDue) : null) : undefined,
      previousOwners: input.previousOwners !== undefined ? (input.previousOwners ?? null) : undefined,
      serviceDueKm: input.serviceDueKm !== undefined ? (input.serviceDueKm ?? null) : undefined,
      serviceDueDate: input.serviceDueDate !== undefined ? (input.serviceDueDate ? new Date(input.serviceDueDate) : null) : undefined,
      // Body / Configuration
      bodyType: input.bodyType !== undefined ? (input.bodyType || null) : undefined,
      doors: input.doors !== undefined ? (input.doors ?? null) : undefined,
      seats: input.seats !== undefined ? (input.seats ?? null) : undefined,
      driveType: input.driveType !== undefined ? (input.driveType || null) : undefined,
      emissionClass: input.emissionClass !== undefined ? (input.emissionClass || null) : undefined,
      exportEnabled: isPrivateVehicle ? false : input.exportEnabled,
      transportCostDomestic: isPrivateVehicle
        ? null
        : input.transportCostDomestic !== undefined
          ? (input.transportCostDomestic ?? null)
          : undefined,
      transportCostAbroad: isPrivateVehicle
        ? null
        : input.transportCostAbroad !== undefined
          ? (input.transportCostAbroad ?? null)
          : undefined,
      customsDuties: isPrivateVehicle
        ? null
        : input.customsDuties !== undefined
          ? (input.customsDuties ?? null)
          : undefined,
      registrationFees: isPrivateVehicle
        ? null
        : input.registrationFees !== undefined
          ? (input.registrationFees ?? null)
          : undefined,
      repairCostsAbroad: isPrivateVehicle
        ? null
        : input.repairCostsAbroad !== undefined
          ? (input.repairCostsAbroad ?? null)
          : undefined,
      dealerPrice: isPrivateVehicle ? null : input.dealerPrice !== undefined ? (input.dealerPrice ?? null) : undefined,
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
          marketplaceTargets: true,
        },
      });

      if (marketplaceTargets) {
        const disabledTargets = await upsertVehicleMarketplaceTargets(
          dealerId,
          id,
          marketplaceTargets.map((item) => ({
            ...item,
            enabled: isPrivateVehicle ? false : item.enabled,
          }))
        );

        for (const disabledTarget of disabledTargets) {
          if (disabledTarget.platform === "autoscout24" && disabledTarget.remoteListingId) {
            await enqueueAndRunMarketplaceJob({
              dealerId,
              platform: "autoscout24",
              vehicleId: id,
              triggerType: "vehicle_update",
              action: "deactivate",
            });
          }
        }
      } else if (isPrivateVehicle) {
        const disabledTargets = await upsertVehicleMarketplaceTargets(dealerId, id, []);
        for (const disabledTarget of disabledTargets) {
          if (disabledTarget.platform === "autoscout24" && disabledTarget.remoteListingId) {
            await enqueueAndRunMarketplaceJob({
              dealerId,
              platform: "autoscout24",
              vehicleId: id,
              triggerType: "vehicle_update",
              action: "deactivate",
            });
          }
        }
      }

      if (queueUploadNow && !isPrivateVehicle) {
        const autoscoutEnabled =
          marketplaceTargets?.some((item) => item.platform === "autoscout24" && item.enabled) ??
          vehicle.marketplaceTargets.some((item) => item.platform === "autoscout24" && item.enabled);
        if (autoscoutEnabled) {
          await enqueueAndRunMarketplaceJob({
            dealerId,
            platform: "autoscout24",
            vehicleId: id,
            triggerType: "vehicle_update",
            action: "sync",
          });
        }
      }

      const refreshedVehicle = await prisma.vehicle.findUnique({
        where: { id },
        include: {
          images: { orderBy: vehicleImageOrderBy },
          documents: { orderBy: { createdAt: "desc" } },
          customer: true,
          supplierRel: true,
          sales: {
            include: { customer: true },
            orderBy: { saleDate: "desc" },
          },
          costs: { orderBy: { createdAt: "asc" } },
          workLog: { orderBy: { createdAt: "asc" } },
          marketplaceTargets: true,
        },
      });

      return c.json({ data: refreshedVehicle ?? vehicle });
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
  const dealerId = getCurrentDealerId(c);

  const existing = await prisma.vehicle.findFirst({
    where: { id, dealerId },
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
  const dealerId = getCurrentDealerId(c);

  const existing = await prisma.vehicle.findFirst({ where: { id, dealerId } });
  if (!existing) {
    return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const requestedPrimary = formData.get("isPrimary") === "true";

  if (!file) {
    return c.json({ error: { message: "No file provided", code: "BAD_REQUEST" } }, 400);
  }

  const existingImagesCount = await prisma.vehicleImage.count({ where: { vehicleId: id, dealerId } });
  const isPrimary = requestedPrimary || existingImagesCount === 0;

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${randomUUID()}.${ext}`;
  const filePath = join(UPLOADS_DIR, fileName);

  const arrayBuffer = await file.arrayBuffer();
  await Bun.write(filePath, arrayBuffer);
  console.info(`[uploads] vehicle_image_saved vehicleId=${id} file=${fileName}`);

  // If this image is set as primary, unset others
  if (isPrimary) {
    await prisma.vehicleImage.updateMany({
      where: { vehicleId: id, dealerId },
      data: { isPrimary: false },
    });
  }

  const image = await prisma.vehicleImage.create({
    data: {
      dealerId,
      url: `/api/uploads/${fileName}`,
      fileName,
      isPrimary,
      vehicleId: id,
    },
  });

  return c.json({ data: image }, 201);
});

// PATCH /api/vehicles/:id/images/:imageId/primary - mark image as primary
vehiclesRouter.patch("/:id/images/:imageId/primary", async (c) => {
  const id = c.req.param("id");
  const imageId = c.req.param("imageId");
  const dealerId = getCurrentDealerId(c);

  const image = await prisma.vehicleImage.findFirst({
    where: { id: imageId, vehicleId: id, dealerId },
  });

  if (!image) {
    return c.json({ error: { message: "Image not found", code: "NOT_FOUND" } }, 404);
  }

  await prisma.$transaction([
    prisma.vehicleImage.updateMany({
      where: { vehicleId: id, dealerId },
      data: { isPrimary: false },
    }),
    prisma.vehicleImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    }),
  ]);

  const updated = await prisma.vehicleImage.findUnique({ where: { id: imageId } });
  return c.json({ data: updated });
});

// DELETE /api/vehicles/:id/images/:imageId - delete image
vehiclesRouter.delete("/:id/images/:imageId", async (c) => {
  const vehicleId = c.req.param("id");
  const imageId = c.req.param("imageId");
  const dealerId = getCurrentDealerId(c);

  const image = await prisma.vehicleImage.findFirst({ where: { id: imageId, dealerId } });
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

  if (image.isPrimary) {
    const fallbackImage = await prisma.vehicleImage.findFirst({
      where: { vehicleId, dealerId },
      orderBy: { createdAt: "asc" },
    });

    if (fallbackImage) {
      await prisma.vehicleImage.update({
        where: { id: fallbackImage.id },
        data: { isPrimary: true },
      });
    }
  }

  return c.body(null, 204);
});

// POST /api/vehicles/:id/documents - upload document
vehiclesRouter.post("/:id/documents", async (c) => {
  const id = c.req.param("id");
  const dealerId = getCurrentDealerId(c);

  const existing = await prisma.vehicle.findFirst({ where: { id, dealerId } });
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
      dealerId,
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
  const dealerId = getCurrentDealerId(c);

  const doc = await prisma.vehicleDocument.findFirst({ where: { id: docId, dealerId } });
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
    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    const existing = await prisma.vehicle.findFirst({ where: { id, dealerId } });
    if (!existing) {
      return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
    }

    const cost = await prisma.vehicleCost.create({
      data: {
        dealerId,
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
  const dealerId = getCurrentDealerId(c);

  const cost = await prisma.vehicleCost.findFirst({ where: { id: costId, dealerId } });
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
    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    const existing = await prisma.vehicle.findFirst({ where: { id, dealerId } });
    if (!existing) {
      return c.json({ error: { message: "Vehicle not found", code: "NOT_FOUND" } }, 404);
    }

    const item = await prisma.workLogItem.create({
      data: {
        dealerId,
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
    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    const existing = await prisma.workLogItem.findFirst({ where: { id: itemId, dealerId } });
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
  const dealerId = getCurrentDealerId(c);

  const existing = await prisma.workLogItem.findFirst({ where: { id: itemId, dealerId } });
  if (!existing) {
    return c.json({ error: { message: "WorkLog item not found", code: "NOT_FOUND" } }, 404);
  }

  await prisma.workLogItem.delete({ where: { id: itemId } });

  return c.body(null, 204);
});

export { vehiclesRouter };
