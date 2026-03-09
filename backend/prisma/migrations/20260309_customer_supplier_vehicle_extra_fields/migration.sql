-- Customer identification document fields
ALTER TABLE "Customer"
ADD COLUMN "idDocumentType" TEXT,
ADD COLUMN "idDocumentNumber" TEXT,
ADD COLUMN "idDocumentValidUntil" TIMESTAMP(3);

-- Supplier address split fields
ALTER TABLE "Supplier"
ADD COLUMN "street" TEXT,
ADD COLUMN "zip" TEXT,
ADD COLUMN "city" TEXT;

-- Vehicle additional registration keys/number
ALTER TABLE "Vehicle"
ADD COLUMN "hsn" TEXT,
ADD COLUMN "tsn" TEXT,
ADD COLUMN "registrationDocNumber" TEXT;
