DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlatformRole') THEN
    CREATE TYPE "PlatformRole" AS ENUM ('user', 'platform_super_admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerStatus') THEN
    CREATE TYPE "DealerStatus" AS ENUM ('active', 'suspended', 'inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerMembershipRole') THEN
    CREATE TYPE "DealerMembershipRole" AS ENUM ('dealer_owner', 'dealer_admin', 'staff');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerSubscriptionStatus') THEN
    CREATE TYPE "DealerSubscriptionStatus" AS ENUM ('active', 'trialing', 'past_due', 'suspended', 'canceled');
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "platformRole" "PlatformRole" NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS "Dealer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "DealerStatus" NOT NULL DEFAULT 'active',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Dealer_slug_key" ON "Dealer"("slug");

CREATE TABLE IF NOT EXISTS "DealerSettings" (
  "id" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "legalName" TEXT,
  "addressLine1" TEXT,
  "zip" TEXT,
  "city" TEXT,
  "country" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "taxId" TEXT,
  "legalRepresentative" TEXT,
  "bankName" TEXT,
  "iban" TEXT,
  "bic" TEXT,
  "logoUrl" TEXT,
  "primaryColor" TEXT,
  "accentColor" TEXT,
  "documentFooterText" TEXT,
  "documentLegalText" TEXT,
  "purchaseTerms" TEXT,
  "saleTerms" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealerSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DealerSettings_dealerId_key" ON "DealerSettings"("dealerId");

CREATE TABLE IF NOT EXISTS "Plan" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
  "featureEntitlements" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Plan_slug_key" ON "Plan"("slug");

CREATE TABLE IF NOT EXISTS "DealerSubscription" (
  "id" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "DealerSubscriptionStatus" NOT NULL DEFAULT 'active',
  "featureOverrides" JSONB,
  "billingNotes" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealerSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DealerSubscription_dealerId_planId_key" ON "DealerSubscription"("dealerId", "planId");
CREATE INDEX IF NOT EXISTS "DealerSubscription_dealerId_status_idx" ON "DealerSubscription"("dealerId", "status");

CREATE TABLE IF NOT EXISTS "DealerMembership" (
  "id" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "DealerMembershipRole" NOT NULL DEFAULT 'staff',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealerMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DealerMembership_dealerId_userId_key" ON "DealerMembership"("dealerId", "userId");
CREATE INDEX IF NOT EXISTS "DealerMembership_userId_isDefault_idx" ON "DealerMembership"("userId", "isDefault");

INSERT INTO "Dealer" ("id", "name", "slug", "status", "isDefault", "createdAt", "updatedAt")
VALUES ('mainauto_default_dealer', 'MainAuto Miltenberg Manuel Rui Fernandes', 'mainauto', 'active', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "DealerSettings" (
  "id", "dealerId", "legalName", "addressLine1", "zip", "city", "country", "phone", "email", "website",
  "taxId", "legalRepresentative", "bankName", "iban", "bic", "primaryColor", "accentColor",
  "documentFooterText", "documentLegalText", "purchaseTerms", "saleTerms", "createdAt", "updatedAt"
)
VALUES (
  'mainauto_default_settings',
  'mainauto_default_dealer',
  'MainAuto Miltenberg Manuel Rui Fernandes',
  'Mainzer Str. 10 + 37',
  '63897',
  'Miltenberg',
  'Deutschland',
  '+49(0)9371-5054245',
  'mainauto@gmail.com',
  'www.mainauto.eu',
  'DE196691148',
  'Manuel Rui Fernandes',
  'Sparkasse Odenwaldkreis',
  'DE 59 5085 1952 0000 1147 77',
  'HELADEF1ERB',
  '#f59e0b',
  '#111827',
  'MainAuto Miltenberg Manuel Rui Fernandes • Mainzer Str. 10 + 37 • 63897 Miltenberg',
  'USt-IdNr. DE196691148 • Vertretungsberechtigt: Manuel Rui Fernandes',
  'Fahrzeugkauf zu den individuell vereinbarten Konditionen.',
  'Verkauf gemaess den im Vertrag aufgefuehrten Bedingungen.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("dealerId") DO NOTHING;

INSERT INTO "Plan" ("id", "slug", "name", "description", "monthlyPriceCents", "featureEntitlements", "isActive", "createdAt", "updatedAt")
VALUES
  ('plan_basic', 'basic', 'Basic', 'Grundpaket fuer die taegliche Fahrzeugverwaltung.', 9900, '{"branding":false,"team_management":false,"documents_advanced":false,"ai_brief_extraction":false}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_pro', 'pro', 'Pro', 'Mit Branding, Teamverwaltung und erweiterten Dokumenten.', 19900, '{"branding":true,"team_management":true,"documents_advanced":true,"ai_brief_extraction":false}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_pro_ai', 'pro-ai', 'Pro + KI', 'Pro-Paket mit KI-Briefextraktion.', 24900, '{"branding":true,"team_management":true,"documents_advanced":true,"ai_brief_extraction":true}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "DealerSubscription" ("id", "dealerId", "planId", "status", "startsAt", "createdAt", "updatedAt")
VALUES ('mainauto_default_subscription', 'mainauto_default_dealer', 'plan_pro_ai', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("dealerId", "planId") DO NOTHING;

INSERT INTO "DealerMembership" ("id", "dealerId", "userId", "role", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
  CONCAT('membership_', "id"),
  'mainauto_default_dealer',
  "id",
  'dealer_owner',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("dealerId", "userId") DO NOTHING;

ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "VehicleCost" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "VehicleImage" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "VehicleDocument" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "VehicleHandoverProtocol" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "CustomerDocument" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "WorkLogItem" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "CustomBrand" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "CustomColor" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "CustomSupplier" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;
ALTER TABLE "CustomConnectorType" ADD COLUMN IF NOT EXISTS "dealerId" TEXT;

UPDATE "Supplier" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "Vehicle" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "VehicleCost" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "VehicleImage" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "VehicleDocument" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "VehicleHandoverProtocol" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "Customer" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "CustomerDocument" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "Sale" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "WorkLogItem" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "CustomBrand" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "CustomColor" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "CustomSupplier" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;
UPDATE "CustomConnectorType" SET "dealerId" = 'mainauto_default_dealer' WHERE "dealerId" IS NULL;

ALTER TABLE "Supplier" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "Vehicle" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "VehicleCost" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "VehicleImage" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "VehicleDocument" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "VehicleHandoverProtocol" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "CustomerDocument" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "WorkLogItem" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "CustomBrand" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "CustomColor" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "CustomSupplier" ALTER COLUMN "dealerId" SET NOT NULL;
ALTER TABLE "CustomConnectorType" ALTER COLUMN "dealerId" SET NOT NULL;

DROP INDEX IF EXISTS "Vehicle_vehicleNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_dealerId_vehicleNumber_key" ON "Vehicle"("dealerId", "vehicleNumber");
CREATE INDEX IF NOT EXISTS "Vehicle_dealerId_status_idx" ON "Vehicle"("dealerId", "status");

DROP INDEX IF EXISTS "CustomBrand_name_key";
DROP INDEX IF EXISTS "CustomColor_name_key";
DROP INDEX IF EXISTS "CustomSupplier_name_key";
DROP INDEX IF EXISTS "CustomConnectorType_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "CustomBrand_dealerId_name_key" ON "CustomBrand"("dealerId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomColor_dealerId_name_key" ON "CustomColor"("dealerId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomSupplier_dealerId_name_key" ON "CustomSupplier"("dealerId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomConnectorType_dealerId_name_key" ON "CustomConnectorType"("dealerId", "name");

DROP TABLE IF EXISTS "Counter";
CREATE TABLE "Counter" (
  "id" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Counter_dealerId_key_key" ON "Counter"("dealerId", "key");

ALTER TABLE "DealerSettings"
  ADD CONSTRAINT "DealerSettings_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealerSubscription"
  ADD CONSTRAINT "DealerSubscription_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealerSubscription"
  ADD CONSTRAINT "DealerSubscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DealerMembership"
  ADD CONSTRAINT "DealerMembership_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealerMembership"
  ADD CONSTRAINT "DealerMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Counter"
  ADD CONSTRAINT "Counter_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleCost" ADD CONSTRAINT "VehicleCost_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleImage" ADD CONSTRAINT "VehicleImage_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleHandoverProtocol" ADD CONSTRAINT "VehicleHandoverProtocol_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkLogItem" ADD CONSTRAINT "WorkLogItem_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomBrand" ADD CONSTRAINT "CustomBrand_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomColor" ADD CONSTRAINT "CustomColor_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomSupplier" ADD CONSTRAINT "CustomSupplier_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomConnectorType" ADD CONSTRAINT "CustomConnectorType_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
