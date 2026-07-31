import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Prisma, type Invoice } from "@prisma/client";
import { prisma } from "../prisma";
import {
  InvoiceCancelSchema,
  InvoiceCreateSchema,
  InvoiceSchema,
} from "../types";
import {
  getCurrentDealer,
  getCurrentDealerId,
  getCurrentUser,
  requireDealerRole,
} from "../lib/request-context";
import { fromCents } from "../lib/money";
import { htmlToPdf } from "./documents";
import { writeAuditLog } from "../lib/audit";
import { getMissingInvoiceMasterData } from "../lib/invoiceValidation";
import { sanitizeGeneratedHtml } from "../lib/documentSecurity";
import {
  buildCancellationArtifact,
  hashHtmlArtifact,
} from "../lib/invoiceArtifacts";
import {
  formatBusinessDate,
  getBusinessCalendarYear,
} from "../lib/businessDates";

const invoicesRouter = new Hono();
const INVOICE_TEMPLATE_VERSION = "invoice-v1";

type InvoiceSnapshot = {
  dealer: {
    name: string;
    address: string;
    city: string;
    country: string;
    email: string;
    taxId: string;
    iban: string;
    bic: string;
  };
  customer: {
    name: string;
    company: string;
    address: string;
    city: string;
    country: string;
  };
  vehicle: {
    vehicleNumber: string;
    description: string;
    vin: string;
    firstRegistration: string | null;
    mileage: number;
  };
  sale: {
    deliveryDate: string;
  };
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(fromCents(cents));
}

function getDownloadArtifact(
  invoice: Pick<
    Invoice,
    | "status"
    | "htmlArtifact"
    | "artifactSha256"
    | "cancellationArtifact"
    | "cancellationArtifactSha256"
  >
): string | null {
  if (invoice.status === "canceled") {
    if (
      !invoice.cancellationArtifact ||
      !invoice.cancellationArtifactSha256 ||
      hashHtmlArtifact(invoice.cancellationArtifact) !==
        invoice.cancellationArtifactSha256
    ) {
      return null;
    }
    return invoice.cancellationArtifact;
  }
  return hashHtmlArtifact(invoice.htmlArtifact) === invoice.artifactSha256
    ? invoice.htmlArtifact
    : null;
}

function invoiceResponse(invoice: Invoice) {
  return InvoiceSchema.parse({
    ...invoice,
    issuedAt: invoice.issuedAt.toISOString(),
    dueAt: invoice.dueAt?.toISOString() ?? null,
    grossAmount: fromCents(invoice.grossCents),
    netAmount: fromCents(invoice.netCents),
    taxAmount: fromCents(invoice.taxCents),
    marginTaxAmount: fromCents(invoice.marginTaxCents),
    artifactSha256: invoice.artifactSha256,
    templateVersion: invoice.templateVersion,
    canceledAt: invoice.canceledAt?.toISOString() ?? null,
    canceledById: invoice.canceledById,
    cancelReason: invoice.cancelReason,
    cancellationArtifactSha256: invoice.cancellationArtifactSha256,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  });
}

type InvoiceRenderData = Pick<
  Invoice,
  | "invoiceNumber"
  | "status"
  | "issuedAt"
  | "dueAt"
  | "grossCents"
  | "netCents"
  | "taxCents"
  | "taxRate"
  | "marginTaxed"
  | "notes"
  | "snapshot"
>;

function invoiceHtml(invoice: InvoiceRenderData): string {
  const snapshot = invoice.snapshot as unknown as InvoiceSnapshot;
  const issuedAt = formatBusinessDate(invoice.issuedAt);
  const dueAt = invoice.dueAt
    ? formatBusinessDate(invoice.dueAt)
    : null;
  const taxLine = invoice.marginTaxed
    ? `<p class="hint">Gebrauchtgegenstände/Sonderregelung gemäß § 25a UStG. Umsatzsteuer wird nicht gesondert ausgewiesen.</p>`
    : `<div><span>MwSt. (${escapeHtml(invoice.taxRate)} %)</span><strong>${formatMoney(invoice.taxCents)}</strong></div>`;

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Rechnung ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, sans-serif; color: #172033; font-size: 12px; line-height: 1.5; }
    h1 { font-size: 28px; margin: 0 0 6px; }
    .top { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 40px; }
    .muted { color: #64748b; }
    .addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 34px; }
    .box { border-top: 2px solid #e2e8f0; padding-top: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th:last-child, td:last-child { text-align: right; }
    .totals { width: 320px; margin: 24px 0 0 auto; }
    .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
    .totals .gross { font-size: 16px; border-top: 2px solid #172033; margin-top: 5px; padding-top: 9px; }
    .hint { margin-top: 24px; font-size: 10px; color: #475569; }
    .canceled { border: 4px solid #b91c1c; color: #b91c1c; font-size: 30px; font-weight: 800; padding: 8px 16px; text-align: center; transform: rotate(-4deg); margin-bottom: 28px; }
    footer { position: fixed; bottom: 0; font-size: 9px; color: #64748b; }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>Rechnung</h1>
      <div class="muted">${escapeHtml(invoice.invoiceNumber)}</div>
    </div>
    <div>
      <strong>${escapeHtml(snapshot.dealer.name)}</strong><br>
      ${escapeHtml(snapshot.dealer.address)}<br>
      ${escapeHtml(snapshot.dealer.city)}<br>
      ${escapeHtml(snapshot.dealer.country)}
    </div>
  </div>
  <div class="addresses">
    <div class="box">
      <strong>Rechnung an</strong><br>
      ${escapeHtml(snapshot.customer.company || snapshot.customer.name)}<br>
      ${snapshot.customer.company ? `${escapeHtml(snapshot.customer.name)}<br>` : ""}
      ${escapeHtml(snapshot.customer.address)}<br>
      ${escapeHtml(snapshot.customer.city)}<br>
      ${escapeHtml(snapshot.customer.country)}
    </div>
    <div class="box">
      Rechnungsdatum: <strong>${issuedAt}</strong><br>
      Lieferdatum: <strong>${escapeHtml(
        formatBusinessDate(new Date(snapshot.sale.deliveryDate))
      )}</strong><br>
      ${dueAt ? `Fällig am: <strong>${dueAt}</strong><br>` : ""}
      Fahrzeugnummer: ${escapeHtml(snapshot.vehicle.vehicleNumber)}
    </div>
  </div>
  <table>
    <thead><tr><th>Position</th><th>Beschreibung</th><th>Betrag</th></tr></thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>
          <strong>${escapeHtml(snapshot.vehicle.description)}</strong><br>
          VIN: ${escapeHtml(snapshot.vehicle.vin || "–")} · Kilometerstand:
          ${escapeHtml(snapshot.vehicle.mileage.toLocaleString("de-DE"))} km
        </td>
        <td>${formatMoney(invoice.marginTaxed ? invoice.grossCents : invoice.netCents)}</td>
      </tr>
    </tbody>
  </table>
  <div class="totals">
    ${invoice.marginTaxed ? "" : `<div><span>Netto</span><strong>${formatMoney(invoice.netCents)}</strong></div>`}
    ${taxLine}
    <div class="gross"><span>Gesamtbetrag</span><strong>${formatMoney(invoice.grossCents)}</strong></div>
  </div>
  ${invoice.notes ? `<p>${escapeHtml(invoice.notes)}</p>` : ""}
  <footer>
    ${escapeHtml(snapshot.dealer.name)} · ${escapeHtml(snapshot.dealer.taxId)} ·
    ${escapeHtml(snapshot.dealer.iban)} · ${escapeHtml(snapshot.dealer.bic)}
  </footer>
</body>
</html>`;
}

invoicesRouter.get("/", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) return forbidden;

  const dealerId = getCurrentDealerId(c);
  const invoices = await prisma.invoice.findMany({
    where: { dealerId },
    orderBy: { issuedAt: "desc" },
  });
  return c.json({ data: invoices.map(invoiceResponse) });
});

invoicesRouter.post("/", zValidator("json", InvoiceCreateSchema), async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) return forbidden;

  const dealerId = getCurrentDealerId(c);
  const dealer = getCurrentDealer(c);
  const settings = dealer.settings as {
    legalName?: string | null;
    displayName?: string | null;
    addressLine1?: string | null;
    zip?: string | null;
    city?: string | null;
    country?: string | null;
    email?: string | null;
    taxId?: string | null;
    iban?: string | null;
    bic?: string | null;
  } | null;
  const data = c.req.valid("json");

  let result:
    | { error: "SALE_NOT_FOUND" }
    | { error: "ACCOUNTING_SNAPSHOT_REQUIRED" }
    | { error: "INVOICE_MASTER_DATA_INCOMPLETE"; missingFields: string[] }
    | { existing: Invoice }
    | { invoice: Invoice };
  try {
    result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: data.saleId, dealerId, status: "completed" },
        include: {
          invoice: true,
          customer: true,
          vehicle: true,
        },
      });
      if (!sale) return { error: "SALE_NOT_FOUND" as const };
      if (sale.invoice) return { existing: sale.invoice };

      if (
        sale.accountingStatus === "legacy_ambiguous" ||
        sale.grossCents === null ||
        sale.netCents === null ||
        sale.taxCents === null ||
        sale.marginTaxCents === null ||
        sale.marginTaxedSnapshot === null
      ) {
        return { error: "ACCOUNTING_SNAPSHOT_REQUIRED" as const };
      }
      const missingFields = getMissingInvoiceMasterData({
        dealer: settings,
        customer: sale.customer,
        marginTaxed: sale.marginTaxedSnapshot,
        taxRate: sale.taxRate,
      });
      if (missingFields.length > 0) {
        return {
          error: "INVOICE_MASTER_DATA_INCOMPLETE" as const,
          missingFields,
        };
      }

      const issuedAt = new Date();
      const invoiceYear = getBusinessCalendarYear(issuedAt);
      const counter = await tx.counter.upsert({
        where: {
          dealerId_key: {
            dealerId,
            key: `invoice:${invoiceYear}`,
          },
        },
        create: {
          dealerId,
          key: `invoice:${invoiceYear}`,
          value: 1,
        },
        update: {
          value: { increment: 1 },
        },
      });
      const invoiceNumber =
        `RE-${invoiceYear}-${String(counter.value).padStart(5, "0")}`;
      const snapshot: InvoiceSnapshot = {
        dealer: {
          name: settings?.legalName || settings?.displayName || dealer.name,
          address: settings?.addressLine1 || "",
          city: [settings?.zip, settings?.city].filter(Boolean).join(" "),
          country: settings?.country || "",
          email: settings?.email || "",
          taxId: settings?.taxId || "",
          iban: settings?.iban || "",
          bic: settings?.bic || "",
        },
        customer: {
          name: `${sale.customer.firstName} ${sale.customer.lastName}`.trim(),
          company: sale.customer.company || "",
          address: sale.customer.address || "",
          city: [sale.customer.zip, sale.customer.city].filter(Boolean).join(" "),
          country: sale.customer.country || "",
        },
      vehicle: {
          vehicleNumber: sale.vehicle.vehicleNumber,
          description: `${sale.vehicle.brand} ${sale.vehicle.model}`.trim(),
          vin: sale.vehicle.vin || "",
          firstRegistration: sale.vehicle.firstRegistration?.toISOString() ?? null,
        mileage: sale.vehicle.mileage,
      },
      sale: {
        deliveryDate: data.deliveryDate.includes("T")
          ? new Date(data.deliveryDate).toISOString()
          : new Date(`${data.deliveryDate}T00:00:00.000Z`).toISOString(),
      },
      };

      const dueAt = data.dueDate
        ? new Date(
            data.dueDate.includes("T")
              ? data.dueDate
              : `${data.dueDate}T00:00:00.000Z`
          )
        : null;
      const notes = data.notes || null;
      const htmlArtifact = sanitizeGeneratedHtml(
        invoiceHtml({
          invoiceNumber,
          status: "issued",
          issuedAt,
          dueAt,
          grossCents: sale.grossCents,
          netCents: sale.netCents,
          taxCents: sale.taxCents,
          taxRate: sale.taxRate,
          marginTaxed: sale.marginTaxedSnapshot,
          notes,
          snapshot: snapshot as unknown as Prisma.JsonValue,
        })
      );
      const artifactSha256 = hashHtmlArtifact(htmlArtifact);
      const invoice = await tx.invoice.create({
        data: {
          dealerId,
          saleId: sale.id,
          invoiceNumber,
          issuedAt,
          dueAt,
          grossCents: sale.grossCents,
          netCents: sale.netCents,
          taxCents: sale.taxCents,
          marginTaxCents: sale.marginTaxCents,
          taxRate: sale.taxRate,
          marginTaxed: sale.marginTaxedSnapshot,
          notes,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          htmlArtifact,
          artifactSha256,
          templateVersion: INVOICE_TEMPLATE_VERSION,
        },
      });
      await writeAuditLog(
        c,
        {
          action: "invoice.issued",
          entityType: "Invoice",
          entityId: invoice.id,
          metadata: {
            saleId: invoice.saleId,
            invoiceNumber: invoice.invoiceNumber,
            artifactSha256: invoice.artifactSha256,
            templateVersion: invoice.templateVersion,
          },
        },
        tx
      );
      return { invoice };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.invoice.findFirst({
        where: { saleId: data.saleId, dealerId },
      });
      if (existing) {
        return c.json({ data: invoiceResponse(existing) }, 200);
      }
    }
    throw error;
  }

  if ("error" in result) {
    if (
      result.error === "INVOICE_MASTER_DATA_INCOMPLETE" &&
      "missingFields" in result
    ) {
      return c.json(
        {
          error: {
            code: result.error,
            message: "Pflichtangaben für die Rechnung sind unvollständig",
            details: { missingFields: result.missingFields },
          },
        },
        422
      );
    }
    if (result.error === "ACCOUNTING_SNAPSHOT_REQUIRED") {
      return c.json(
        {
          error: {
            code: result.error,
            message:
              "Die Preisbasis dieses Altverkaufs muss vor der Rechnungserstellung geprüft werden",
          },
        },
        409
      );
    }
    return c.json(
      { error: { code: result.error, message: "Verkauf nicht gefunden" } },
      404
    );
  }
  if ("existing" in result) {
    return c.json({ data: invoiceResponse(result.existing) }, 200);
  }
  const invoice = result.invoice;
  if (!invoice) {
    throw new Error("Invoice transaction completed without a result");
  }
  return c.json({ data: invoiceResponse(invoice) }, 201);
});

invoicesRouter.get("/:id", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) return forbidden;

  const invoice = await prisma.invoice.findFirst({
    where: { id: c.req.param("id"), dealerId: getCurrentDealerId(c) },
  });
  if (!invoice) {
    return c.json({ error: { code: "NOT_FOUND", message: "Rechnung nicht gefunden" } }, 404);
  }
  return c.json({ data: invoiceResponse(invoice) });
});

invoicesRouter.get("/:id/html", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) return forbidden;

  const invoice = await prisma.invoice.findFirst({
    where: { id: c.req.param("id"), dealerId: getCurrentDealerId(c) },
  });
  if (!invoice) {
    return c.json({ error: { code: "NOT_FOUND", message: "Rechnung nicht gefunden" } }, 404);
  }
  const artifact = getDownloadArtifact(invoice);
  if (!artifact) {
    return c.json(
      {
        error: {
          code: "INVOICE_ARTIFACT_INTEGRITY_ERROR",
          message: "Die gespeicherte Rechnungsrevision ist beschädigt",
        },
      },
      500
    );
  }
  return c.json({ data: { html: artifact, invoice: invoiceResponse(invoice) } });
});

invoicesRouter.get("/:id/pdf", async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
  if (forbidden) return forbidden;

  const invoice = await prisma.invoice.findFirst({
    where: { id: c.req.param("id"), dealerId: getCurrentDealerId(c) },
  });
  if (!invoice) {
    return c.json({ error: { code: "NOT_FOUND", message: "Rechnung nicht gefunden" } }, 404);
  }

  const artifact = getDownloadArtifact(invoice);
  if (!artifact) {
    return c.json(
      {
        error: {
          code: "INVOICE_ARTIFACT_INTEGRITY_ERROR",
          message: "Die gespeicherte Rechnungsrevision ist beschädigt",
        },
      },
      500
    );
  }
  const pdf = await htmlToPdf(artifact, { alreadySanitized: true });
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="Rechnung_${invoice.invoiceNumber}.pdf"`);
  return c.body(pdf as unknown as ReadableStream);
});

invoicesRouter.post(
  "/:id/cancel",
  zValidator("json", InvoiceCancelSchema),
  async (c) => {
  const forbidden = requireDealerRole(c, ["dealer_owner"]);
  if (forbidden) return forbidden;
  const dealerId = getCurrentDealerId(c);
  const reason = c.req.valid("json").reason;
  const actor = getCurrentUser(c);
  const existing = await prisma.invoice.findFirst({
    where: { id: c.req.param("id"), dealerId },
  });
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "Rechnung nicht gefunden" } }, 404);
  }
  if (existing.status === "canceled") {
    return c.json({ data: invoiceResponse(existing) });
  }
  const canceledAt = new Date();
  const cancellationArtifact = buildCancellationArtifact({
    originalHtml: existing.htmlArtifact,
    canceledAt,
    reason,
  });
  const cancellationArtifactSha256 = hashHtmlArtifact(cancellationArtifact);
  const invoice = await prisma.$transaction(async (tx) => {
    const canceled = await tx.invoice.update({
      where: { id: existing.id },
      data: {
        status: "canceled",
        canceledAt,
        canceledById: actor.id,
        cancelReason: reason,
        cancellationArtifact,
        cancellationArtifactSha256,
      },
    });
    await writeAuditLog(
      c,
      {
        action: "invoice.canceled",
        entityType: "Invoice",
        entityId: canceled.id,
        metadata: { invoiceNumber: canceled.invoiceNumber, reason },
      },
      tx
    );
    return canceled;
  });
  return c.json({ data: invoiceResponse(invoice) });
  }
);

export { invoicesRouter };
