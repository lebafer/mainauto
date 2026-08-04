import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  SaleAccountingSnapshotResolveSchema,
  SaleAccountingSnapshotSchema,
  SaleCreateSchema,
  SaleUpdateSchema,
} from "../types";
import {
  getCurrentDealerId,
  getCurrentEntitlements,
  getCurrentUser,
  requireDealerRole,
} from "../lib/request-context";
import {
  MoneyOverflowError,
  fromCents,
  toCents,
} from "../lib/money";
import { writeAuditLog } from "../lib/audit";
import {
  buildSaleAccountingSnapshot,
  resolveLegacySaleAccounting,
} from "../lib/saleAccounting";
import {
  buildCancellationArtifact,
  hashHtmlArtifact,
} from "../lib/invoiceArtifacts";

const salesRouter = new Hono();

function withSaleAmounts<T extends {
  salePrice: number;
  grossCents: number | null;
  netCents: number | null;
  taxCents: number | null;
  marginTaxCents: number | null;
}>(sale: T) {
  return {
    ...sale,
    grossSalePrice: sale.grossCents === null ? null : fromCents(sale.grossCents),
    netSalePrice: sale.netCents === null ? null : fromCents(sale.netCents),
    taxAmount: sale.taxCents === null ? null : fromCents(sale.taxCents),
    marginTaxAmount:
      sale.marginTaxCents === null ? null : fromCents(sale.marginTaxCents),
  };
}

function isSaleConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

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

  return c.json({ data: sales.map(withSaleAmounts) });
});

// POST /api/sales - create sale
salesRouter.post(
  "/",
  zValidator("json", SaleCreateSchema),
  async (c) => {
    const dealerId = getCurrentDealerId(c);
    const privateVehiclesEnabled = getCurrentEntitlements(c).private_vehicles === true;
    const data = c.req.valid("json");

    try {
      const sale = await prisma.$transaction(
        async (tx) => {
          const vehicle = await tx.vehicle.findFirst({
            where: { id: data.vehicleId, dealerId },
            include: { costs: true },
          });
          if (!vehicle) {
            throw new SaleBusinessError("NOT_FOUND", "Vehicle not found");
          }
          if (privateVehiclesEnabled && vehicle.isPrivate) {
            throw new SaleBusinessError(
              "PRIVATE_VEHICLE",
              "Private Fahrzeuge koennen nicht verkauft werden"
            );
          }

          const customer = await tx.customer.findFirst({
            where: { id: data.customerId, dealerId },
          });
          if (!customer) {
            throw new SaleBusinessError("CUSTOMER_NOT_FOUND", "Customer not found");
          }

          const claimed = await tx.vehicle.updateMany({
            where: {
              id: data.vehicleId,
              dealerId,
              status: { not: "sold" },
            },
            data: {
              status: "sold",
              customerId: data.customerId,
            },
          });
          if (claimed.count !== 1) {
            throw new SaleBusinessError(
              "VEHICLE_ALREADY_SOLD",
              "Das Fahrzeug wurde bereits verkauft"
            );
          }

          const accounting = buildSaleAccountingSnapshot(
            data.salePrice,
            data.taxRate,
            vehicle,
            data.priceMode
          );
          const createdSale = await tx.sale.create({
            data: {
              dealerId,
              vehicleId: data.vehicleId,
              customerId: data.customerId,
              salePrice: fromCents(accounting.grossCents),
              taxRate: data.taxRate,
              ...accounting,
              saleDate: data.saleDate ? new Date(data.saleDate) : new Date(),
              notes: data.notes,
            },
            include: {
              vehicle: true,
              customer: true,
            },
          });
          await writeAuditLog(
            c,
            {
              action: "sale.completed",
              entityType: "Sale",
              entityId: createdSale.id,
              metadata: {
                vehicleId: createdSale.vehicleId,
                customerId: createdSale.customerId,
              },
            },
            tx
          );
          return createdSale;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      return c.json({ data: withSaleAmounts(sale) }, 201);
    } catch (error) {
      if (error instanceof SaleBusinessError) {
        const status = error.code === "NOT_FOUND" || error.code === "CUSTOMER_NOT_FOUND" ? 404 : 409;
        return c.json({ error: { message: error.message, code: error.code } }, status);
      }
      if (isSaleConflict(error)) {
        return c.json(
          {
            error: {
              message: "Das Fahrzeug wurde bereits verkauft",
              code: "VEHICLE_ALREADY_SOLD",
            },
          },
          409
        );
      }
      if (error instanceof MoneyOverflowError) {
        return c.json(
          {
            error: {
              message: "Beträge oder Kostensumme überschreiten den unterstützten Bereich",
              code: "MONEY_RANGE_EXCEEDED",
            },
          },
          422
        );
      }
      throw error;
    }
  }
);


// PUT /api/sales/:id - edit an existing sale
salesRouter.put(
  "/:id",
  zValidator("json", SaleUpdateSchema),
  async (c) => {
    const dealerId = getCurrentDealerId(c);
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await prisma.sale.findFirst({
      where: { id, dealerId },
      include: { vehicle: { include: { costs: true } }, customer: true },
    });
    if (!existing) {
      return c.json({ error: { message: "Verkauf nicht gefunden", code: "NOT_FOUND" } }, 404);
    }
    if (existing.status !== "completed") {
      return c.json(
        { error: { message: "Stornierte Verkäufe können nicht bearbeitet werden", code: "SALE_REVERSED" } },
        409
      );
    }

    if (data.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: data.customerId, dealerId },
        select: { id: true },
      });
      if (!customer) {
        return c.json({ error: { message: "Kunde nicht gefunden", code: "CUSTOMER_NOT_FOUND" } }, 404);
      }
    }

    try {
      const shouldReprice =
        data.salePrice !== undefined || data.taxRate !== undefined || data.priceMode !== undefined;
      const amount = data.salePrice ?? existing.salePrice;
      const taxRate = data.taxRate ?? existing.taxRate;
      const priceMode = data.priceMode ?? existing.priceModeSnapshot ?? "gross";
      const accounting = shouldReprice
        ? buildSaleAccountingSnapshot(
            amount,
            taxRate,
            existing.vehicle,
            priceMode
          )
        : undefined;

      const updated = await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.update({
          where: { id },
          data: {
            customerId: data.customerId ?? undefined,
            salePrice: accounting ? fromCents(accounting.grossCents) : undefined,
            taxRate: shouldReprice ? taxRate : undefined,
            ...(accounting ?? {}),
            saleDate: data.saleDate ? new Date(data.saleDate) : undefined,
            notes: data.notes === null ? null : data.notes ?? undefined,
          },
          include: { vehicle: true, customer: true },
        });

        if (data.customerId && data.customerId !== existing.customerId) {
          await tx.vehicle.update({
            where: { id: existing.vehicleId },
            data: { customerId: data.customerId },
          });
        }

        await writeAuditLog(
          c,
          {
            action: "sale.updated",
            entityType: "Sale",
            entityId: id,
            metadata: {
              before: {
                customerId: existing.customerId,
                salePrice: existing.salePrice,
                taxRate: existing.taxRate,
                priceMode: existing.priceModeSnapshot,
                saleDate: existing.saleDate,
                notes: existing.notes,
              },
              after: {
                customerId: sale.customerId,
                salePrice: sale.salePrice,
                taxRate: sale.taxRate,
                priceMode: sale.priceModeSnapshot,
                saleDate: sale.saleDate,
                notes: sale.notes,
              },
            },
          },
          tx
        );

        return sale;
      });

      return c.json({ data: withSaleAmounts(updated) });
    } catch (error) {
      if (error instanceof MoneyOverflowError) {
        return c.json(
          {
            error: {
              message: "Beträge oder Kostensumme überschreiten den unterstützten Bereich",
              code: "MONEY_RANGE_EXCEEDED",
            },
          },
          422
        );
      }
      throw error;
    }
  }
);

salesRouter.post(
  "/:id/accounting-snapshot",
  zValidator("json", SaleAccountingSnapshotResolveSchema),
  async (c) => {
    const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
    if (forbidden) return forbidden;

    const dealerId = getCurrentDealerId(c);
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const existing = await prisma.sale.findFirst({
      where: { id, dealerId },
      include: { vehicle: true, customer: true },
    });
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Verkauf nicht gefunden" } }, 404);
    }
    if (existing.accountingStatus !== "legacy_ambiguous") {
      return c.json(
        {
          error: {
            code: "ACCOUNTING_SNAPSHOT_ALREADY_RESOLVED",
            message: "Die historische Preisbasis wurde bereits festgelegt",
          },
        },
        409
      );
    }

    try {
      const purchasePriceCents =
        data.purchasePrice === undefined
          ? existing.purchasePriceCents
          : toCents(data.purchasePrice);
      const manualCostsCents =
        data.manualCosts === undefined
          ? existing.manualCostsCents
          : toCents(data.manualCosts);
      const exportCostsCents =
        data.exportCosts === undefined
          ? existing.exportCostsCents
          : toCents(data.exportCosts);
      if (
        purchasePriceCents === null ||
        manualCostsCents === null ||
        exportCostsCents === null
      ) {
        return c.json(
          {
            error: {
              code: "COST_SNAPSHOT_INCOMPLETE",
              message: "Historische Einkaufs- und Kostendaten sind unvollständig",
            },
          },
          409
        );
      }
      const accounting = resolveLegacySaleAccounting({
        storedPrice: existing.salePrice,
        taxRate: existing.taxRate,
        historicTaxMode: data.historicTaxMode,
        historicPriceMode: data.historicPriceMode,
        purchasePriceCents,
        manualCostsCents,
        exportCostsCents,
      });

      const resolved = await prisma.$transaction(async (tx) => {
        const changed = await tx.sale.updateMany({
          where: { id, dealerId, accountingStatus: "legacy_ambiguous" },
          data: accounting,
        });
        if (changed.count !== 1) {
          throw new AccountingSnapshotConflictError();
        }
        const sale = await tx.sale.findUniqueOrThrow({
          where: { id },
          include: { vehicle: true, customer: true },
        });
        await writeAuditLog(
          c,
          {
            action: "sale.accounting_snapshot_resolved",
            entityType: "Sale",
            entityId: id,
            metadata: {
              historicTaxMode: data.historicTaxMode,
              historicPriceMode: data.historicPriceMode ?? null,
              before: {
                accountingStatus: existing.accountingStatus,
                grossCents: existing.grossCents,
                netCents: existing.netCents,
                taxCents: existing.taxCents,
                marginTaxCents: existing.marginTaxCents,
                purchasePriceCents: existing.purchasePriceCents,
                manualCostsCents: existing.manualCostsCents,
                exportCostsCents: existing.exportCostsCents,
              },
              after: {
                accountingStatus: sale.accountingStatus,
                grossCents: sale.grossCents,
                netCents: sale.netCents,
                taxCents: sale.taxCents,
                marginTaxCents: sale.marginTaxCents,
                purchasePriceCents: sale.purchasePriceCents,
                manualCostsCents: sale.manualCostsCents,
                exportCostsCents: sale.exportCostsCents,
              },
            },
          },
          tx
        );
        return sale;
      });
      const snapshot = SaleAccountingSnapshotSchema.parse({
        accountingStatus: resolved.accountingStatus,
        priceMode: resolved.priceModeSnapshot,
        marginTaxed: resolved.marginTaxedSnapshot,
        grossCents: resolved.grossCents,
        netCents: resolved.netCents,
        taxCents: resolved.taxCents,
        marginTaxCents: resolved.marginTaxCents,
        purchasePriceCents: resolved.purchasePriceCents,
        manualCostsCents: resolved.manualCostsCents,
        exportCostsCents: resolved.exportCostsCents,
        totalCostCents: resolved.totalCostCents,
        grossAmount: fromCents(resolved.grossCents!),
        netAmount: fromCents(resolved.netCents!),
        taxAmount: fromCents(resolved.taxCents!),
        marginTaxAmount: fromCents(resolved.marginTaxCents!),
        purchasePrice: fromCents(resolved.purchasePriceCents!),
        manualCosts: fromCents(resolved.manualCostsCents!),
        exportCosts: fromCents(resolved.exportCostsCents!),
        totalCost: fromCents(resolved.totalCostCents!),
      });
      return c.json({ data: { sale: withSaleAmounts(resolved), accountingSnapshot: snapshot } });
    } catch (error) {
      if (error instanceof AccountingSnapshotConflictError) {
        return c.json(
          {
            error: {
              code: "ACCOUNTING_SNAPSHOT_ALREADY_RESOLVED",
              message: "Die historische Preisbasis wurde parallel bereits festgelegt",
            },
          },
          409
        );
      }
      if (error instanceof MoneyOverflowError) {
        return c.json(
          {
            error: {
              code: "MONEY_RANGE_EXCEEDED",
              message: "Beträge oder Kostensumme überschreiten den unterstützten Bereich",
            },
          },
          422
        );
      }
      throw error;
    }
  }
);

// DELETE /api/sales/:id - reverse a sale without deleting its legal history
salesRouter.delete("/:id", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) {
    return forbidden;
  }

  const id = c.req.param("id");
  const dealerId = getCurrentDealerId(c);
  const actor = getCurrentUser(c);

  const existing = await prisma.sale.findFirst({
    where: { id, dealerId },
    include: { vehicle: true, invoice: true },
  });

  if (!existing) {
    return c.json({ error: { message: "Sale not found", code: "NOT_FOUND" } }, 404);
  }
  if (existing.status === "reversed") {
    return c.json({ data: withSaleAmounts(existing) });
  }
  const automaticCancellation = existing.invoice
    ? (() => {
        const canceledAt = new Date();
        const reason = "Zugehöriger Verkauf wurde storniert";
        const artifact = buildCancellationArtifact({
          originalHtml: existing.invoice.htmlArtifact,
          canceledAt,
          reason,
        });
        return {
          canceledAt,
          reason,
          artifact,
          artifactSha256: hashHtmlArtifact(artifact),
        };
      })()
    : null;

  await prisma.$transaction(async (tx) => {
    const transitioned = await tx.sale.updateMany({
      where: { id, dealerId, status: "completed" },
      data: {
        status: "reversed",
        reversedAt: new Date(),
        reversedById: actor.id,
      },
    });
    if (transitioned.count === 0) {
      return;
    }
    if (existing.invoice) {
      await tx.invoice.updateMany({
        where: { id: existing.invoice.id, dealerId, status: "issued" },
        data: {
          status: "canceled",
          canceledAt: automaticCancellation!.canceledAt,
          canceledById: actor.id,
          cancelReason: automaticCancellation!.reason,
          cancellationArtifact: automaticCancellation!.artifact,
          cancellationArtifactSha256:
            automaticCancellation!.artifactSha256,
        },
      });
    }

    const otherCompletedSales = await tx.sale.count({
      where: {
        dealerId,
        vehicleId: existing.vehicleId,
        id: { not: existing.id },
        status: "completed",
      },
    });
    if (otherCompletedSales === 0) {
      await tx.vehicle.updateMany({
        where: {
          id: existing.vehicleId,
          dealerId,
          status: "sold",
        },
        data: {
          status: "available",
          customerId: null,
        },
      });
    }
    await writeAuditLog(
      c,
      {
        action: "sale.reversed",
        entityType: "Sale",
        entityId: id,
        metadata: { vehicleId: existing.vehicleId },
      },
      tx
    );
  });

  const reversed = await prisma.sale.findUnique({
    where: { id },
    include: { vehicle: true, customer: true },
  });
  return c.json({ data: reversed ? withSaleAmounts(reversed) : null });
});

export { salesRouter };

class SaleBusinessError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "CUSTOMER_NOT_FOUND"
      | "PRIVATE_VEHICLE"
      | "VEHICLE_ALREADY_SOLD",
    message: string
  ) {
    super(message);
  }
}

class AccountingSnapshotConflictError extends Error {}
