import { prisma } from "../src/prisma";

const duplicateSales = await prisma.$queryRaw<
  Array<{ dealerId: string; vehicleId: string; saleCount: bigint }>
>`
  SELECT "dealerId", "vehicleId", COUNT(*) AS "saleCount"
  FROM "Sale"
  GROUP BY "dealerId", "vehicleId"
  HAVING COUNT(*) > 1
`;

const soldWithoutSale = await prisma.$queryRaw<
  Array<{ dealerId: string; vehicleId: string; vehicleNumber: string }>
>`
  SELECT vehicle."dealerId", vehicle."id" AS "vehicleId", vehicle."vehicleNumber"
  FROM "Vehicle" AS vehicle
  WHERE vehicle."status" = 'sold'
    AND NOT EXISTS (
      SELECT 1 FROM "Sale" AS sale
      WHERE sale."dealerId" = vehicle."dealerId"
        AND sale."vehicleId" = vehicle."id"
    )
`;

const saleWithUnsoldVehicle = await prisma.$queryRaw<
  Array<{ dealerId: string; saleId: string; vehicleId: string; vehicleStatus: string }>
>`
  SELECT sale."dealerId", sale."id" AS "saleId", sale."vehicleId",
         vehicle."status" AS "vehicleStatus"
  FROM "Sale" AS sale
  JOIN "Vehicle" AS vehicle ON vehicle."id" = sale."vehicleId"
  WHERE vehicle."status" <> 'sold'
`;

const regularTaxedLegacySales = await prisma.$queryRaw<
  Array<{ dealerId: string; saleId: string; vehicleId: string; salePrice: number; taxRate: number }>
>`
  SELECT sale."dealerId", sale."id" AS "saleId", sale."vehicleId",
         sale."salePrice", sale."taxRate"
  FROM "Sale" AS sale
  JOIN "Vehicle" AS vehicle ON vehicle."id" = sale."vehicleId"
  WHERE vehicle."marginTaxed" = false
  ORDER BY sale."dealerId", sale."saleDate"
`;

const outOfRangeMoney = await prisma.$queryRaw<
  Array<{ dealerId: string; saleId: string; vehicleId: string; reason: string }>
>`
  SELECT sale."dealerId", sale."id" AS "saleId", sale."vehicleId",
         CASE
           WHEN ABS(sale."salePrice"::numeric * 100) > 2147483647 THEN 'salePrice'
           WHEN ABS(vehicle."purchasePrice"::numeric * 100) > 2147483647 THEN 'purchasePrice'
           WHEN ABS(COALESCE(costs.amount, 0)::numeric * 100) > 2147483647 THEN 'manualCosts'
           ELSE 'totalCost'
         END AS reason
  FROM "Sale" AS sale
  JOIN "Vehicle" AS vehicle ON vehicle."id" = sale."vehicleId"
  LEFT JOIN LATERAL (
    SELECT SUM(cost."amount") AS amount
    FROM "VehicleCost" AS cost
    WHERE cost."vehicleId" = sale."vehicleId"
      AND cost."dealerId" = sale."dealerId"
  ) AS costs ON true
  WHERE ABS(sale."salePrice"::numeric * 100) > 2147483647
     OR ABS(vehicle."purchasePrice"::numeric * 100) > 2147483647
     OR ABS(COALESCE(costs.amount, 0)::numeric * 100) > 2147483647
     OR ABS((
       vehicle."purchasePrice"
       + COALESCE(costs.amount, 0)
       + COALESCE(vehicle."transportCostDomestic", 0)
       + CASE WHEN vehicle."exportEnabled" THEN
           COALESCE(vehicle."transportCostAbroad", 0)
           + COALESCE(vehicle."customsDuties", 0)
           + COALESCE(vehicle."registrationFees", 0)
           + COALESCE(vehicle."repairCostsAbroad", 0)
         ELSE 0
         END
     )::numeric * 100) > 2147483647
`;

const report = {
  generatedAt: new Date().toISOString(),
  blocking: {
    duplicateSales: duplicateSales.map((row) => ({
      ...row,
      saleCount: Number(row.saleCount),
    })),
    outOfRangeMoney,
  },
  reconcileManually: {
    soldWithoutSale,
    saleWithUnsoldVehicle,
    regularTaxedLegacySales,
  },
};

console.log(JSON.stringify(report, null, 2));
await prisma.$disconnect();

if (duplicateSales.length > 0 || outOfRangeMoney.length > 0) {
  process.exitCode = 1;
}
