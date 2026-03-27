import type { MarketplaceConnection, MarketplaceSyncJob, Prisma, Vehicle } from "@prisma/client";
import { join } from "path";
import { prisma } from "../prisma";
import { decryptMarketplaceSecret } from "./marketplace-crypto";
import {
  autoscoutCreateListing,
  autoscoutDeleteListing,
  autoscoutGetMakes,
  autoscoutGetReferences,
  autoscoutPatchListing,
  autoscoutUpdateListing,
  autoscoutUploadImage,
} from "./autoscout24";

const UPLOADS_DIR = join(import.meta.dir, "../../uploads");

type VehicleWithMarketplaceRelations = Prisma.VehicleGetPayload<{
  include: {
    images: true;
    marketplaceTargets: true;
  };
}>;

type JobWithRelations = Prisma.MarketplaceSyncJobGetPayload<{
  include: {
    vehicle: {
      include: {
        images: true;
        marketplaceTargets: true;
      };
    };
  };
}>;

type TargetInput = {
  platform: "autoscout24";
  enabled: boolean;
};

type ReadinessResult = {
  ready: boolean;
  issues: string[];
};

function normalizeString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parsePowerKw(vehicle: Pick<Vehicle, "powerKw" | "power">): number | null {
  if (typeof vehicle.powerKw === "number" && Number.isFinite(vehicle.powerKw)) {
    return Math.round(vehicle.powerKw);
  }

  const rawPower = typeof vehicle.power === "string" ? Number(vehicle.power) : Number(vehicle.power ?? NaN);
  if (!Number.isFinite(rawPower) || rawPower <= 0) {
    return null;
  }

  return Math.round(rawPower / 1.35962);
}

function formatYearMonth(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseFeatures(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  } catch {
    // fall through
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDescription(vehicle: Pick<Vehicle, "brand" | "model" | "notes" | "features">) {
  const features = parseFeatures(vehicle.features).slice(0, 12);
  const cleanedNotes = normalizeString(vehicle.notes?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") ?? null);
  const lines = [
    `${vehicle.brand} ${vehicle.model}`,
    cleanedNotes,
    features.length > 0 ? `Ausstattung: ${features.join(", ")}` : null,
  ].filter((value): value is string => Boolean(value));

  return lines.join("\n\n").slice(0, 4000);
}

function normalizeRemoteStatus(status?: string | null) {
  switch (status) {
    case "Active":
      return "active" as const;
    case "Inactive":
      return "inactive" as const;
    default:
      return "unknown" as const;
  }
}

async function getAutoscoutCredentials(connection: MarketplaceConnection) {
  if (!connection.username || !connection.customerId) {
    throw new Error("AutoScout24-Verbindung ist unvollständig");
  }

  const password = decryptMarketplaceSecret(connection.encryptedSecret);
  if (!password) {
    throw new Error("AutoScout24-Zugangsdaten fehlen");
  }

  return {
    username: connection.username,
    password,
    customerId: connection.customerId,
  };
}

function findByName<T extends { id: string | number; name: string }>(
  items: T[],
  candidates: string[]
) {
  const normalizedCandidates = candidates
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return items.find((item) => normalizedCandidates.includes(item.name.trim().toLowerCase())) ?? null;
}

async function buildAutoscoutPayload(vehicle: VehicleWithMarketplaceRelations): Promise<{
  readiness: ReadinessResult;
  payload: Record<string, unknown> | null;
}> {
  const issues: string[] = [];
  const powerKw = parsePowerKw(vehicle);
  const firstRegistrationDate = formatYearMonth(vehicle.firstRegistration);
  const description = buildDescription(vehicle);

  if (!vehicle.brand.trim()) issues.push("Marke fehlt");
  if (!vehicle.model.trim()) issues.push("Modell fehlt");
  if (!vehicle.mileage || vehicle.mileage <= 0) issues.push("Kilometerstand fehlt");
  if (!vehicle.sellingPrice || vehicle.sellingPrice <= 0) issues.push("Verkaufspreis fehlt");
  if (!firstRegistrationDate) issues.push("Erstzulassung fehlt");
  if (!normalizeString(vehicle.fuelType)) issues.push("Kraftstoff fehlt");
  if (!normalizeString(vehicle.transmission)) issues.push("Getriebe fehlt");
  if (!powerKw) issues.push("Leistung fehlt");
  if (!normalizeString(vehicle.bodyType)) issues.push("Karosserieform fehlt");
  if (vehicle.doors == null || vehicle.doors <= 0) issues.push("Türen fehlen");
  if (vehicle.seats == null || vehicle.seats <= 0) issues.push("Sitzplätze fehlen");
  if (vehicle.images.length === 0) issues.push("Mindestens ein Bild ist erforderlich");
  if (!description.trim()) issues.push("Beschreibung fehlt");

  if (issues.length > 0) {
    return {
      readiness: { ready: false, issues },
      payload: null,
    };
  }

  const [makes, fuelCategories, fuelTypes, transmissions, bodyTypes, drivetrains, emissionStandards] =
    await Promise.all([
      autoscoutGetMakes(),
      autoscoutGetReferences("FuelCategory"),
      autoscoutGetReferences("FuelType"),
      autoscoutGetReferences("Transmission"),
      autoscoutGetReferences("BodyType"),
      autoscoutGetReferences("Drivetrain"),
      autoscoutGetReferences("EuEmissionStandard"),
    ]);

  const make = makes.find((item) => item.name.trim().toLowerCase() === vehicle.brand.trim().toLowerCase()) ?? null;
  if (!make) {
    issues.push(`Marke '${vehicle.brand}' konnte nicht auf AutoScout24 gemappt werden`);
  }

  const model =
    make?.models.find((item) => item.name.trim().toLowerCase() === vehicle.model.trim().toLowerCase()) ?? null;
  if (!model) {
    issues.push(`Modell '${vehicle.model}' konnte nicht auf AutoScout24 gemappt werden`);
  }

  const normalizedFuel = vehicle.fuelType?.trim().toLowerCase() ?? "";
  let fuelCategoryId: string | null = null;
  let primaryFuelTypeId: string | null = null;
  let additionalFuelTypes: string[] = [];

  if (normalizedFuel.includes("diesel")) {
    fuelCategoryId = "D";
    primaryFuelTypeId = "7";
  } else if (normalizedFuel.includes("elektro")) {
    fuelCategoryId = "E";
    primaryFuelTypeId = "12";
  } else if (normalizedFuel.includes("hybrid")) {
    fuelCategoryId = "2";
    primaryFuelTypeId = "12";
    additionalFuelTypes = ["2"];
  } else if (normalizedFuel.includes("gas") || normalizedFuel.includes("lpg")) {
    fuelCategoryId = "L";
    primaryFuelTypeId = "9";
  } else if (normalizedFuel.includes("cng")) {
    fuelCategoryId = "C";
    primaryFuelTypeId = "10";
  } else {
    fuelCategoryId = "B";
    primaryFuelTypeId = "2";
  }

  if (!fuelCategories.some((item) => item.id === fuelCategoryId)) {
    issues.push(`Kraftstoff '${vehicle.fuelType}' konnte nicht gemappt werden`);
  }

  if (!fuelTypes.some((item) => item.id === primaryFuelTypeId)) {
    issues.push(`Primärer Kraftstoff '${vehicle.fuelType}' konnte nicht gemappt werden`);
  }

  const transmission = findByName(transmissions, [
    vehicle.transmission ?? "",
    vehicle.transmission?.toLowerCase().includes("autom") ? "Automatik" : "",
    vehicle.transmission?.toLowerCase().includes("schalt") ? "Schaltgetriebe" : "",
  ]);
  if (!transmission) {
    issues.push(`Getriebe '${vehicle.transmission}' konnte nicht gemappt werden`);
  }

  const bodyTypeMap: Record<string, string[]> = {
    limousine: ["Limousine"],
    kombi: ["Kombi"],
    suv: ["SUV/Geländewagen/Pickup"],
    pickup: ["SUV/Geländewagen/Pickup"],
    "van/minivan": ["Van/Kleinbus"],
    transporter: ["Transporter"],
    coupé: ["Coupé"],
    coupe: ["Coupé"],
    cabrio: ["Cabrio"],
  };

  const bodyTypeCandidates = [
    vehicle.bodyType ?? "",
    ...(bodyTypeMap[(vehicle.bodyType ?? "").trim().toLowerCase()] ?? []),
  ];
  const bodyType = findByName(bodyTypes, bodyTypeCandidates);
  if (!bodyType) {
    issues.push(`Karosserieform '${vehicle.bodyType}' konnte nicht gemappt werden`);
  }

  const drivetrain = findByName(drivetrains, [
    vehicle.driveType ?? "",
    vehicle.driveType === "AWD" || vehicle.driveType === "4x4" ? "Allrad" : "",
    vehicle.driveType === "FWD" ? "Front" : "",
    vehicle.driveType === "RWD" ? "Heck" : "",
  ]);

  const emission = findByName(emissionStandards, [vehicle.emissionClass ?? ""]);

  if (issues.length > 0 || !make || !model || !transmission || !bodyType || !fuelCategoryId || !primaryFuelTypeId) {
    return {
      readiness: { ready: false, issues },
      payload: null,
    };
  }

  const payload: Record<string, unknown> = {
    vehicleType: "C",
    availability: {
      availabilityType: 1,
    },
    offerType: "U",
    make: make.id,
    model: model.id,
    publication: {
      status: "Inactive",
      channels: [{ id: "AS24" }],
    },
    prices: {
      public: {
        price: Math.round(vehicle.sellingPrice),
        currency: "EUR",
        isNegotiable: false,
        isTaxDeductible: vehicle.marginTaxed !== true,
      },
      dealer: {
        price: Math.round(vehicle.dealerPrice ?? vehicle.sellingPrice),
        currency: "EUR",
      },
    },
    crossReferenceId: vehicle.vehicleNumber.slice(0, 50),
    offerReferenceId: vehicle.id,
    firstRegistrationDate,
    fuelCategory: fuelCategoryId,
    primaryFuelType: Number(primaryFuelTypeId),
    transmission: transmission.id,
    power: powerKw,
    mileage: vehicle.mileage,
    bodyType: Number(bodyType.id),
    doorCount: vehicle.doors,
    seatCount: vehicle.seats,
    description,
    condition: {
      hadAccident: vehicle.hasDamage === true,
    },
  };

  if (additionalFuelTypes.length > 0) {
    payload.additionalFuelTypes = additionalFuelTypes.map((item) => Number(item));
  }
  if (normalizeString(vehicle.color)) {
    payload.bodyColorName = vehicle.color;
  }
  if (normalizeString(vehicle.vin)) {
    payload.vin = vehicle.vin;
  }
  if (normalizeString(vehicle.hsn)) {
    payload.hsn = vehicle.hsn;
  }
  if (normalizeString(vehicle.tsn)) {
    payload.tsn = vehicle.tsn;
  }
  if (typeof vehicle.co2Emission === "number" && Number.isFinite(vehicle.co2Emission)) {
    payload.co2Emissions = Math.round(vehicle.co2Emission);
  }
  if (drivetrain) {
    payload.drivetrain = drivetrain.id;
  }
  if (emission) {
    payload.euEmissionStandard = emission.id;
  }
  if (typeof vehicle.previousOwners === "number") {
    payload.previousOwnerCount = vehicle.previousOwners;
  }
  if (vehicle.huDue) {
    payload.nextInspectionDate = formatYearMonth(vehicle.huDue);
  }

  return {
    readiness: { ready: true, issues: [] },
    payload,
  };
}

async function uploadVehicleImagesToAutoscout(
  vehicle: VehicleWithMarketplaceRelations,
  credentials: { username: string; password: string; customerId: string }
) {
  const uploadedImageReferences: Array<{ id: string }> = [];
  const orderedImages = [...vehicle.images].sort((left, right) => {
    if (left.isPrimary === right.isPrimary) {
      return left.createdAt.getTime() - right.createdAt.getTime();
    }
    return left.isPrimary ? -1 : 1;
  });

  for (const image of orderedImages) {
    const filePath = join(UPLOADS_DIR, image.fileName);
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      continue;
    }

    const contentType =
      image.fileName.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const bytes = await file.arrayBuffer();
    const uploaded = await autoscoutUploadImage(credentials, { bytes, contentType });
    uploadedImageReferences.push({ id: uploaded.id });
  }

  return uploadedImageReferences;
}

async function markJobRunning(jobId: string) {
  await prisma.marketplaceSyncJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      startedAt: new Date(),
      finishedAt: null,
      errorSummary: null,
    },
  });
}

async function markJobFinished(
  jobId: string,
  data: {
    status: "succeeded" | "failed" | "skipped";
    errorSummary?: string | null;
    result?: Record<string, unknown> | null;
  }
) {
  await prisma.marketplaceSyncJob.update({
    where: { id: jobId },
    data: {
      status: data.status,
      finishedAt: new Date(),
      errorSummary: data.errorSummary ?? null,
      result: data.result ?? undefined,
    },
  });
}

export async function upsertVehicleMarketplaceTargets(
  dealerId: string,
  vehicleId: string,
  targets: TargetInput[]
) {
  const currentTargets = await prisma.vehicleMarketplaceTarget.findMany({
    where: { dealerId, vehicleId },
  });
  const targetMap = new Map(targets.map((item) => [item.platform, item.enabled]));
  const disabledTargets: typeof currentTargets = [];

  for (const currentTarget of currentTargets) {
    const nextEnabled = targetMap.has(currentTarget.platform as "autoscout24")
      ? targetMap.get(currentTarget.platform as "autoscout24") ?? false
      : false;

    if (currentTarget.enabled && !nextEnabled) {
      disabledTargets.push(currentTarget);
    }

    await prisma.vehicleMarketplaceTarget.update({
      where: { id: currentTarget.id },
      data: {
        enabled: nextEnabled,
      },
    });
  }

  for (const target of targets) {
    const existing = currentTargets.find((item) => item.platform === target.platform);
    if (existing) {
      continue;
    }

    await prisma.vehicleMarketplaceTarget.create({
      data: {
        dealerId,
        vehicleId,
        platform: target.platform,
        enabled: target.enabled,
      },
    });
  }

  return disabledTargets;
}

export async function enqueueMarketplaceJob(input: {
  dealerId: string;
  platform: "autoscout24";
  vehicleId: string;
  triggerType: MarketplaceSyncJob["triggerType"];
  action: "sync" | "activate" | "deactivate" | "delete";
  payload?: Record<string, unknown>;
}) {
  return prisma.marketplaceSyncJob.create({
    data: {
      dealerId: input.dealerId,
      platform: input.platform,
      vehicleId: input.vehicleId,
      triggerType: input.triggerType,
      action: input.action,
      payload: input.payload ?? {},
    },
  });
}

export async function getVehicleMarketplaceReadiness(
  vehicle: VehicleWithMarketplaceRelations,
  platform: "autoscout24"
): Promise<ReadinessResult> {
  if (platform !== "autoscout24") {
    return { ready: false, issues: ["Unbekannte Plattform"] };
  }

  const result = await buildAutoscoutPayload(vehicle);
  return result.readiness;
}

async function runAutoscoutJob(job: JobWithRelations) {
  const vehicle = job.vehicle;
  if (!vehicle) {
    throw new Error("Fahrzeug für Sync-Job nicht gefunden");
  }

  const target = vehicle.marketplaceTargets.find((item) => item.platform === "autoscout24") ?? null;
  const connection = await prisma.marketplaceConnection.findUnique({
    where: {
      dealerId_platform: {
        dealerId: job.dealerId,
        platform: "autoscout24",
      },
    },
  });

  if (!connection || connection.status !== "connected") {
    throw new Error("AutoScout24 ist nicht verbunden");
  }

  const credentials = await getAutoscoutCredentials(connection);

  if (job.action === "delete") {
    if (!target?.remoteListingId) {
      return {
        targetData: {
          remoteStatus: "deleted",
          remoteUrl: null,
          remoteListingId: null,
          lastError: null,
          lastSyncedAt: new Date(),
        },
        result: { skipped: true },
      };
    }

    await autoscoutDeleteListing({
      ...credentials,
      listingId: target.remoteListingId,
    });

    return {
      targetData: {
        remoteStatus: "deleted",
        remoteUrl: null,
        remoteListingId: null,
        lastError: null,
        lastSyncedAt: new Date(),
      },
      result: { remoteStatus: "deleted" },
    };
  }

  if ((job.action === "activate" || job.action === "deactivate") && !target?.remoteListingId) {
    throw new Error("Kein AutoScout24-Listing vorhanden");
  }

  if (job.action === "activate" || job.action === "deactivate") {
    const response = await autoscoutPatchListing({
      ...credentials,
      listingId: target!.remoteListingId!,
    }, {
      publication: {
        status: job.action === "activate" ? "Active" : "Inactive",
        channels: [{ id: "AS24" }],
      },
    });

    const remoteUrl = response.publication?.channels?.find((item) => item.id === "AS24")?.url ?? target?.remoteUrl ?? null;
    return {
      targetData: {
        remoteStatus: normalizeRemoteStatus(response.publication?.status),
        remoteUrl,
        remoteListingId: response.id ?? target?.remoteListingId ?? null,
        lastError: null,
        lastSyncedAt: new Date(),
      },
      result: {
        remoteStatus: normalizeRemoteStatus(response.publication?.status),
        remoteUrl,
      },
    };
  }

  const built = await buildAutoscoutPayload(vehicle);
  if (!built.readiness.ready || !built.payload) {
    throw new Error(built.readiness.issues.join(" | "));
  }

  const uploadedImages = await uploadVehicleImagesToAutoscout(vehicle, credentials);
  if (uploadedImages.length === 0) {
    throw new Error("Kein gültiges Bild für AutoScout24 gefunden");
  }

  const payload = {
    ...built.payload,
    images: uploadedImages,
  };

  const response = target?.remoteListingId
    ? await autoscoutUpdateListing(
        {
          ...credentials,
          listingId: target.remoteListingId,
        },
        payload
      )
    : await autoscoutCreateListing(credentials, payload);

  const remoteUrl = response.publication?.channels?.find((item) => item.id === "AS24")?.url ?? null;
  return {
    targetData: {
      remoteStatus: normalizeRemoteStatus(response.publication?.status),
      remoteUrl,
      remoteListingId: response.id,
      lastError: null,
      lastSyncedAt: new Date(),
      enabled: true,
    },
    result: {
      remoteListingId: response.id,
      remoteStatus: normalizeRemoteStatus(response.publication?.status),
      remoteUrl,
    },
  };
}

export async function runMarketplaceJob(jobId: string) {
  const job = await prisma.marketplaceSyncJob.findUnique({
    where: { id: jobId },
    include: {
      vehicle: {
        include: {
          images: true,
          marketplaceTargets: true,
        },
      },
    },
  });

  if (!job) {
    throw new Error("Sync-Job nicht gefunden");
  }

  await markJobRunning(jobId);

  try {
    let outcome: {
      targetData: Record<string, unknown>;
      result: Record<string, unknown>;
    };

    switch (job.platform) {
      case "autoscout24":
        outcome = await runAutoscoutJob(job);
        break;
      default:
        throw new Error("Nicht unterstützte Plattform");
    }

    if (job.vehicleId) {
      await prisma.vehicleMarketplaceTarget.upsert({
        where: {
          vehicleId_platform: {
            vehicleId: job.vehicleId,
            platform: job.platform,
          },
        },
        update: {
          ...outcome.targetData,
          lastSyncJobId: job.id,
        },
        create: {
          dealerId: job.dealerId,
          vehicleId: job.vehicleId,
          platform: job.platform,
          enabled: job.action === "delete" ? false : true,
          ...(outcome.targetData as Prisma.VehicleMarketplaceTargetUncheckedCreateInput),
          lastSyncJobId: job.id,
        },
      });
    }

    await markJobFinished(job.id, {
      status: "succeeded",
      result: outcome.result,
    });
    return { status: "succeeded" as const, ...outcome.result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Marketplace-Sync fehlgeschlagen";
    if (job.vehicleId) {
      await prisma.vehicleMarketplaceTarget.upsert({
        where: {
          vehicleId_platform: {
            vehicleId: job.vehicleId,
            platform: job.platform,
          },
        },
        update: {
          lastError: message,
          lastSyncJobId: job.id,
        },
        create: {
          dealerId: job.dealerId,
          vehicleId: job.vehicleId,
          platform: job.platform,
          enabled: job.action !== "delete",
          lastError: message,
          lastSyncJobId: job.id,
        },
      });
    }

    await prisma.marketplaceConnection.updateMany({
      where: {
        dealerId: job.dealerId,
        platform: job.platform,
      },
      data: {
        lastError: message,
      },
    });

    await markJobFinished(job.id, {
      status: "failed",
      errorSummary: message,
    });
    throw error;
  }
}

export async function enqueueAndRunMarketplaceJob(input: {
  dealerId: string;
  platform: "autoscout24";
  vehicleId: string;
  triggerType: MarketplaceSyncJob["triggerType"];
  action: "sync" | "activate" | "deactivate" | "delete";
  payload?: Record<string, unknown>;
}) {
  const job = await enqueueMarketplaceJob(input);
  try {
    const result = await runMarketplaceJob(job.id);
    return { jobId: job.id, result };
  } catch (error) {
    return {
      jobId: job.id,
      error: error instanceof Error ? error.message : "Marketplace-Sync fehlgeschlagen",
    };
  }
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? "0");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function scheduleMatches(
  date: Date,
  schedule: Pick<Prisma.MarketplaceSyncScheduleUncheckedCreateInput, "frequency" | "hour" | "minute" | "timezone">
) {
  const parts = getTimeZoneParts(date, schedule.timezone);
  if (parts.minute !== schedule.minute) {
    return false;
  }
  if (schedule.frequency === "daily") {
    return parts.hour === schedule.hour;
  }
  return true;
}

export function computeNextScheduleRun(
  schedule: Pick<Prisma.MarketplaceSyncScheduleUncheckedCreateInput, "frequency" | "hour" | "minute" | "timezone">,
  fromDate = new Date()
) {
  let cursor = new Date(fromDate.getTime() + 60_000);
  cursor.setUTCSeconds(0, 0);

  for (let index = 0; index < 60 * 48; index += 1) {
    if (scheduleMatches(cursor, schedule)) {
      return cursor;
    }
    cursor = new Date(cursor.getTime() + 60_000);
  }

  return new Date(fromDate.getTime() + 60 * 60 * 1000);
}

let scheduleLoopRunning = false;

export async function runMarketplaceSchedules() {
  if (scheduleLoopRunning) {
    return;
  }

  scheduleLoopRunning = true;
  try {
    const now = new Date();
    const schedules = await prisma.marketplaceSyncSchedule.findMany({
      where: {
        enabled: true,
        nextRunAt: {
          lte: now,
        },
      },
      orderBy: { nextRunAt: "asc" },
    });

    for (const schedule of schedules) {
      const claimed = await prisma.marketplaceSyncSchedule.updateMany({
        where: {
          id: schedule.id,
          lockedAt: schedule.lockedAt,
        },
        data: {
          lockedAt: now,
        },
      });

      if (claimed.count === 0) {
        continue;
      }

      const targets = await prisma.vehicleMarketplaceTarget.findMany({
        where: {
          dealerId: schedule.dealerId,
          platform: schedule.platform,
          enabled: true,
        },
        select: {
          vehicleId: true,
        },
      });

      for (const target of targets) {
        await enqueueAndRunMarketplaceJob({
          dealerId: schedule.dealerId,
          platform: schedule.platform,
          vehicleId: target.vehicleId,
          triggerType: "schedule",
          action: "sync",
        });
      }

      await prisma.marketplaceSyncSchedule.update({
        where: { id: schedule.id },
        data: {
          lockedAt: null,
          lastRunAt: now,
          nextRunAt: computeNextScheduleRun(schedule, now),
        },
      });
    }
  } finally {
    scheduleLoopRunning = false;
  }
}
