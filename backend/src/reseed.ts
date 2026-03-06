import { prisma } from "./prisma";
import { seedDemoData } from "./seed";

async function reseed() {
  console.log("Deleting existing data...");

  // Delete in order to respect foreign keys
  await prisma.workLogItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.vehicleCost.deleteMany({});
  await prisma.vehicleDocument.deleteMany({});
  await prisma.vehicleImage.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.customBrand.deleteMany({});

  console.log("All existing demo data deleted.");
  console.log("Running seedDemoData...");

  await seedDemoData();

  console.log("Done!");
  process.exit(0);
}

reseed().catch((err) => {
  console.error("Reseed failed:", err);
  process.exit(1);
});
