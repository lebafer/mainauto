import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import {
  MarketplaceConnectionUpsertSchema,
  MarketplaceConnectionVerifySchema,
  MarketplacePlatformSchema,
  MarketplaceSyncRequestSchema,
  MarketplaceSyncScheduleUpsertSchema,
  MarketplaceVehicleBulkUpdateSchema,
} from "../types";
import {
  getCurrentDealerId,
  requireDealerRole,
  requireEntitlement,
} from "../lib/request-context";
import { AutoscoutApiError, autoscoutVerifyCredentials } from "../lib/autoscout24";
import { encryptMarketplaceSecret } from "../lib/marketplace-crypto";
import {
  computeNextScheduleRun,
  enqueueAndRunMarketplaceJob,
  getVehicleMarketplaceReadiness,
  upsertVehicleMarketplaceTargets,
} from "../lib/marketplace-sync";

const marketplacesRouter = new Hono();

function formatAutoscoutSetupError(error: unknown) {
  if (error instanceof AutoscoutApiError) {
    if (error.status === 401) {
      return {
        status: 401,
        code: "AUTOSCOUT24_INVALID_CREDENTIALS",
        message:
          "Der normale AutoScout24-Haendler-Login funktioniert hier nicht. Fuer die Listing-API brauchst du separate Data-Provider/API-Zugangsdaten von AutoScout24, nicht den Login mit E-Mail-Code.",
      };
    }

    if (error.status === 403) {
      return {
        status: 403,
        code: "AUTOSCOUT24_FORBIDDEN",
        message:
          "Diese AutoScout24 API-Zugangsdaten haben keinen Zugriff auf das angeforderte Kundenkonto. Der Haendler muss den Data Provider freischalten und die passende customerId bereitstellen.",
      };
    }

    if (error.status >= 500) {
      return {
        status: 502,
        code: "AUTOSCOUT24_UPSTREAM_ERROR",
        message:
          "AutoScout24 meldet aktuell einen Serverfehler. Bitte spaeter erneut versuchen. Falls du den normalen Haendler-Login verwendet hast, brauchst du stattdessen die Listing-API-Zugangsdaten.",
      };
    }

    return {
      status: 400,
      code: "AUTOSCOUT24_REQUEST_FAILED",
      message: error.body || "AutoScout24 konnte die Zugangsdaten nicht verarbeiten.",
    };
  }

  return {
    status: 500,
    code: "AUTOSCOUT24_UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : "AutoScout24 konnte nicht verifiziert werden.",
  };
}

function requireMarketplaceAccess(c: Parameters<typeof requireDealerRole>[0]) {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) {
    return forbidden;
  }

  return requireEntitlement(c, "marketplace_exports");
}

marketplacesRouter.get("/", async (c) => {
  const accessError = requireMarketplaceAccess(c);
  if (accessError) {
    return accessError;
  }

  const dealerId = getCurrentDealerId(c);
  const [connections, schedules] = await Promise.all([
    prisma.marketplaceConnection.findMany({
      where: { dealerId },
      orderBy: { platform: "asc" },
    }),
    prisma.marketplaceSyncSchedule.findMany({
      where: { dealerId },
      orderBy: { platform: "asc" },
    }),
  ]);

  return c.json({ data: { connections, schedules } });
});

marketplacesRouter.post(
  "/verify",
  zValidator("json", MarketplaceConnectionVerifySchema),
  async (c) => {
    const accessError = requireMarketplaceAccess(c);
    if (accessError) {
      return accessError;
    }

    const data = c.req.valid("json");
    switch (data.platform) {
      case "autoscout24": {
        try {
          const customers = await autoscoutVerifyCredentials({
            username: data.username,
            password: data.password,
          });
          return c.json({
            data: {
              platform: data.platform,
              username: data.username,
              customers,
            },
          });
        } catch (error) {
          const formatted = formatAutoscoutSetupError(error);
          return c.json(
            {
              error: {
                code: formatted.code,
                message: formatted.message,
              },
            },
            formatted.status
          );
        }
      }
      default:
        return c.json({ error: { code: "BAD_REQUEST", message: "Unbekannte Plattform" } }, 400);
    }
  }
);

marketplacesRouter.put(
  "/connection",
  zValidator("json", MarketplaceConnectionUpsertSchema),
  async (c) => {
    const accessError = requireMarketplaceAccess(c);
    if (accessError) {
      return accessError;
    }

    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    let status: "pending" | "connected" = "pending";
    let lastVerifiedAt: Date | null = null;
    let lastError: string | null = null;

    if (data.platform === "autoscout24") {
      try {
        const customers = await autoscoutVerifyCredentials({
          username: data.username,
          password: data.password,
        });

        if (data.customerId) {
          const matchingCustomer = customers.find((item) => item.id === data.customerId);
          if (!matchingCustomer) {
            return c.json(
              {
                error: {
                  code: "BAD_REQUEST",
                  message: "customerId gehoert nicht zu diesem AutoScout24-Konto",
                },
              },
              400
            );
          }
          status = "connected";
          lastVerifiedAt = new Date();
        }
      } catch (error) {
        const formatted = formatAutoscoutSetupError(error);
        return c.json(
          {
            error: {
              code: formatted.code,
              message: formatted.message,
            },
          },
          formatted.status
        );
      }
    }

    const connection = await prisma.marketplaceConnection.upsert({
      where: {
        dealerId_platform: {
          dealerId,
          platform: data.platform,
        },
      },
      update: {
        username: data.username,
        encryptedSecret: encryptMarketplaceSecret(data.password),
        customerId: data.customerId ?? null,
        displayName: data.displayName?.trim() || "AutoScout24",
        status,
        lastVerifiedAt,
        lastError,
      },
      create: {
        dealerId,
        platform: data.platform,
        username: data.username,
        encryptedSecret: encryptMarketplaceSecret(data.password),
        customerId: data.customerId ?? null,
        displayName: data.displayName?.trim() || "AutoScout24",
        status,
        lastVerifiedAt,
        lastError,
      },
    });

    return c.json({ data: connection });
  }
);

marketplacesRouter.put(
  "/schedules",
  zValidator("json", MarketplaceSyncScheduleUpsertSchema),
  async (c) => {
    const accessError = requireMarketplaceAccess(c);
    if (accessError) {
      return accessError;
    }

    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    const schedule = await prisma.marketplaceSyncSchedule.upsert({
      where: {
        dealerId_platform: {
          dealerId,
          platform: data.platform,
        },
      },
      update: {
        enabled: data.enabled,
        frequency: data.frequency,
        hour: data.hour,
        minute: data.minute,
        timezone: data.timezone,
        nextRunAt: data.enabled ? computeNextScheduleRun(data) : null,
      },
      create: {
        dealerId,
        platform: data.platform,
        enabled: data.enabled,
        frequency: data.frequency,
        hour: data.hour,
        minute: data.minute,
        timezone: data.timezone,
        nextRunAt: data.enabled ? computeNextScheduleRun(data) : null,
      },
    });

    return c.json({ data: schedule });
  }
);

marketplacesRouter.get("/:platform/vehicles", async (c) => {
  const accessError = requireMarketplaceAccess(c);
  if (accessError) {
    return accessError;
  }

  const platform = MarketplacePlatformSchema.parse(c.req.param("platform"));
  const dealerId = getCurrentDealerId(c);
  const vehicles = await prisma.vehicle.findMany({
    where: { dealerId, isPrivate: false },
    include: {
      images: true,
      marketplaceTargets: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const data = await Promise.all(
    vehicles.map(async (vehicle) => ({
      ...vehicle,
      readiness: await getVehicleMarketplaceReadiness(vehicle, platform),
      target: vehicle.marketplaceTargets.find((item) => item.platform === platform) ?? null,
    }))
  );

  return c.json({ data });
});

marketplacesRouter.post(
  "/vehicles/bulk-targets",
  zValidator("json", MarketplaceVehicleBulkUpdateSchema),
  async (c) => {
    const accessError = requireMarketplaceAccess(c);
    if (accessError) {
      return accessError;
    }

    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    for (const vehicleId of data.vehicleIds) {
      const disabledTargets = await upsertVehicleMarketplaceTargets(dealerId, vehicleId, [data.target]);
      for (const disabledTarget of disabledTargets) {
        if (disabledTarget.platform === "autoscout24" && disabledTarget.remoteListingId) {
          await enqueueAndRunMarketplaceJob({
            dealerId,
            platform: "autoscout24",
            vehicleId,
            triggerType: "manual_action",
            action: "deactivate",
          });
        }
      }
    }

    return c.json({ data: { updated: data.vehicleIds.length } });
  }
);

marketplacesRouter.post(
  "/sync",
  zValidator("json", MarketplaceSyncRequestSchema),
  async (c) => {
    const accessError = requireMarketplaceAccess(c);
    if (accessError) {
      return accessError;
    }

    const dealerId = getCurrentDealerId(c);
    const data = c.req.valid("json");

    const results = [];
    for (const vehicleId of data.vehicleIds) {
      const result = await enqueueAndRunMarketplaceJob({
        dealerId,
        platform: data.platform,
        vehicleId,
        triggerType: "manual",
        action: "sync",
      });
      results.push({ vehicleId, ...result });
    }

    return c.json({ data: results });
  }
);

marketplacesRouter.post("/:platform/vehicles/:vehicleId/:action", async (c) => {
  const accessError = requireMarketplaceAccess(c);
  if (accessError) {
    return accessError;
  }

  const dealerId = getCurrentDealerId(c);
  const platform = MarketplacePlatformSchema.parse(c.req.param("platform"));
  const vehicleId = c.req.param("vehicleId");
  const action = c.req.param("action");

  if (!["sync", "activate", "deactivate", "delete"].includes(action)) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Ungültige Aktion" } }, 400);
  }

  const result = await enqueueAndRunMarketplaceJob({
    dealerId,
    platform,
    vehicleId,
    triggerType: "manual_action",
    action: action as "sync" | "activate" | "deactivate" | "delete",
  });

  return c.json({ data: result });
});

export { marketplacesRouter };
