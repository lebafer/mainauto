CREATE TYPE "InvoiceStatus" AS ENUM ('issued', 'canceled');
CREATE TYPE "BusinessDocumentType" AS ENUM ('INVOICE');
CREATE TYPE "SaleStatus" AS ENUM ('completed', 'reversed');
CREATE TYPE "SaleAccountingStatus" AS ENUM ('verified', 'legacy_snapshot', 'legacy_ambiguous');
CREATE TYPE "SalePriceMode" AS ENUM ('gross', 'net');
CREATE TYPE "StoredDocumentType" AS ENUM (
  'general',
  'legacy',
  'contract',
  'purchase_contract',
  'handover_protocol',
  'other_legal'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Sale" AS sale
    JOIN "Vehicle" AS vehicle ON vehicle."id" = sale."vehicleId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(cost."amount"), 0) AS amount
      FROM "VehicleCost" AS cost
      WHERE cost."vehicleId" = sale."vehicleId"
        AND cost."dealerId" = sale."dealerId"
    ) AS manual ON true
    WHERE ABS(sale."salePrice"::numeric * 100) > 2147483647
       OR ABS(vehicle."purchasePrice"::numeric * 100) > 2147483647
       OR ABS(manual.amount::numeric * 100) > 2147483647
       OR ABS((
         vehicle."purchasePrice"
         + manual.amount
         + COALESCE(vehicle."transportCostDomestic", 0)
         + CASE WHEN vehicle."exportEnabled" THEN
             COALESCE(vehicle."transportCostAbroad", 0)
             + COALESCE(vehicle."customsDuties", 0)
             + COALESCE(vehicle."registrationFees", 0)
             + COALESCE(vehicle."repairCostsAbroad", 0)
           ELSE 0
           END
       )::numeric * 100) > 2147483647
  ) THEN
    RAISE EXCEPTION
      'Sales migration blocked: monetary value exceeds INTEGER cents range; run migration:preflight-sales';
  END IF;
END $$;

-- Existing documents are retained conservatively because their legal relevance
-- cannot be inferred reliably from historic file names.
ALTER TABLE "VehicleDocument"
  ADD COLUMN "documentType" "StoredDocumentType" NOT NULL DEFAULT 'legacy',
  ADD COLUMN "retentionLocked" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "softDeletedAt" TIMESTAMP(3);
ALTER TABLE "CustomerDocument"
  ADD COLUMN "documentType" "StoredDocumentType" NOT NULL DEFAULT 'legacy',
  ADD COLUMN "retentionLocked" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "softDeletedAt" TIMESTAMP(3);
ALTER TABLE "VehicleDocument"
  ALTER COLUMN "documentType" SET DEFAULT 'general',
  ALTER COLUMN "retentionLocked" SET DEFAULT false;
ALTER TABLE "CustomerDocument"
  ALTER COLUMN "documentType" SET DEFAULT 'general',
  ALTER COLUMN "retentionLocked" SET DEFAULT false;

ALTER TABLE "Sale"
  ADD COLUMN "status" "SaleStatus" NOT NULL DEFAULT 'completed',
  ADD COLUMN "reversedAt" TIMESTAMP(3),
  ADD COLUMN "reversedById" TEXT,
  ADD COLUMN "accountingStatus" "SaleAccountingStatus" NOT NULL DEFAULT 'legacy_ambiguous',
  ADD COLUMN "priceModeSnapshot" "SalePriceMode",
  ADD COLUMN "marginTaxedSnapshot" BOOLEAN,
  ADD COLUMN "grossCents" INTEGER,
  ADD COLUMN "netCents" INTEGER,
  ADD COLUMN "taxCents" INTEGER,
  ADD COLUMN "marginTaxCents" INTEGER,
  ADD COLUMN "purchasePriceCents" INTEGER,
  ADD COLUMN "manualCostsCents" INTEGER,
  ADD COLUMN "exportCostsCents" INTEGER,
  ADD COLUMN "totalCostCents" INTEGER;

-- Freeze only the currently available purchase/cost state for legacy sales.
-- Neither historic tax mode nor gross/net price basis can be inferred safely from
-- the currently editable Vehicle row. Every legacy sale therefore stays blocked
-- until an owner/admin explicitly reconciles it.
UPDATE "Sale" AS sale
SET
  "purchasePriceCents" = ROUND(vehicle."purchasePrice"::numeric * 100)::integer,
  "manualCostsCents" = COALESCE((
    SELECT ROUND(SUM(cost."amount")::numeric * 100)::integer
    FROM "VehicleCost" AS cost
    WHERE cost."vehicleId" = sale."vehicleId"
      AND cost."dealerId" = sale."dealerId"
  ), 0),
  "exportCostsCents" =
    ROUND(COALESCE(vehicle."transportCostDomestic", 0)::numeric * 100)::integer
    + CASE WHEN vehicle."exportEnabled" THEN
        ROUND((
          COALESCE(vehicle."transportCostAbroad", 0)
          + COALESCE(vehicle."customsDuties", 0)
          + COALESCE(vehicle."registrationFees", 0)
          + COALESCE(vehicle."repairCostsAbroad", 0)
        )::numeric * 100)::integer
      ELSE 0
      END
FROM "Vehicle" AS vehicle
WHERE vehicle."id" = sale."vehicleId"
  AND vehicle."dealerId" = sale."dealerId";

UPDATE "Sale"
SET
  "totalCostCents" =
    COALESCE("purchasePriceCents", 0)
    + COALESCE("manualCostsCents", 0)
    + COALESCE("exportCostsCents", 0),
  "grossCents" = NULL,
  "marginTaxCents" = NULL,
  "netCents" = NULL,
  "taxCents" = NULL,
  "marginTaxedSnapshot" = NULL,
  "accountingStatus" = 'legacy_ambiguous'::"SaleAccountingStatus",
  "priceModeSnapshot" = NULL;

ALTER TABLE "Sale"
  ALTER COLUMN "accountingStatus" SET DEFAULT 'verified';

-- Only one non-reversed sale may exist per vehicle. A vehicle can be sold again
-- after a traceable reversal without deleting its history.
CREATE UNIQUE INDEX "Sale_one_completed_per_vehicle_key"
  ON "Sale"("dealerId", "vehicleId")
  WHERE "status" = 'completed';
CREATE INDEX "Sale_dealerId_vehicleId_status_idx"
  ON "Sale"("dealerId", "vehicleId", "status");

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_reversedById_fkey"
  FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Sale" DROP CONSTRAINT "Sale_vehicleId_fkey";
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_customerId_fkey";
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_dealerId_fkey";
ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "documentType" "BusinessDocumentType" NOT NULL DEFAULT 'INVOICE',
  "invoiceNumber" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'issued',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "grossCents" INTEGER NOT NULL,
  "netCents" INTEGER NOT NULL,
  "taxCents" INTEGER NOT NULL,
  "marginTaxCents" INTEGER NOT NULL DEFAULT 0,
  "taxRate" DOUBLE PRECISION NOT NULL,
  "marginTaxed" BOOLEAN NOT NULL,
  "htmlArtifact" TEXT NOT NULL,
  "artifactSha256" TEXT NOT NULL,
  "templateVersion" TEXT NOT NULL,
  "canceledAt" TIMESTAMP(3),
  "canceledById" TEXT,
  "cancelReason" TEXT,
  "cancellationArtifact" TEXT,
  "cancellationArtifactSha256" TEXT,
  "notes" TEXT,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_saleId_key" ON "Invoice"("saleId");
CREATE UNIQUE INDEX "Invoice_dealerId_invoiceNumber_key" ON "Invoice"("dealerId", "invoiceNumber");
CREATE INDEX "Invoice_dealerId_issuedAt_idx" ON "Invoice"("dealerId", "issuedAt");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_canceledById_fkey"
  FOREIGN KEY ("canceledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "dealerId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_dealerId_createdAt_idx" ON "AuditLog"("dealerId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
