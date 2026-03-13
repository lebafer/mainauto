-- CreateTable
CREATE TABLE "VehicleHandoverProtocol" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleHandoverProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleHandoverProtocol_vehicleId_key" ON "VehicleHandoverProtocol"("vehicleId");

-- AddForeignKey
ALTER TABLE "VehicleHandoverProtocol"
ADD CONSTRAINT "VehicleHandoverProtocol_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
