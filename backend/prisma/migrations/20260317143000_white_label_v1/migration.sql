DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerSetupStatus') THEN
    CREATE TYPE "DealerSetupStatus" AS ENUM ('pending_setup', 'ready_for_dns', 'active', 'suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerDomainStatus') THEN
    CREATE TYPE "DealerDomainStatus" AS ENUM ('pending_dns', 'active', 'failed', 'disabled');
  END IF;
END $$;

ALTER TABLE "Dealer"
  ADD COLUMN IF NOT EXISTS "setupStatus" "DealerSetupStatus" NOT NULL DEFAULT 'pending_setup';

ALTER TABLE "DealerSettings"
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "supportEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "faviconUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "loginHeadline" TEXT;

CREATE TABLE IF NOT EXISTS "DealerDomain" (
  "id" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "host" TEXT NOT NULL,
  "status" "DealerDomainStatus" NOT NULL DEFAULT 'pending_dns',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "verificationToken" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealerDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DealerDomain_host_key" ON "DealerDomain"("host");
CREATE INDEX IF NOT EXISTS "DealerDomain_dealerId_status_idx" ON "DealerDomain"("dealerId", "status");

ALTER TABLE "DealerDomain"
  ADD CONSTRAINT "DealerDomain_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "DealerDomain" ("id", "dealerId", "host", "status", "isPrimary", "createdAt", "updatedAt")
SELECT
  CONCAT('dealer_domain_', "id"),
  "id",
  CONCAT("slug", '.tenant.local'),
  CASE WHEN "status" = 'active' THEN 'active'::"DealerDomainStatus" ELSE 'pending_dns'::"DealerDomainStatus" END,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Dealer"
WHERE NOT EXISTS (
  SELECT 1 FROM "DealerDomain" dd WHERE dd."dealerId" = "Dealer"."id"
);

UPDATE "Dealer"
SET "setupStatus" = CASE
  WHEN "status" = 'active' THEN 'active'::"DealerSetupStatus"
  WHEN "status" = 'suspended' THEN 'suspended'::"DealerSetupStatus"
  ELSE 'pending_setup'::"DealerSetupStatus"
END
WHERE "setupStatus" = 'pending_setup';

CREATE TABLE IF NOT EXISTS "OnboardingInquiry" (
  "id" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "website" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingInquiry_pkey" PRIMARY KEY ("id")
);
