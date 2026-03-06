import { prisma } from "./prisma";
import { auth } from "./auth";
import { env } from "./env";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";

const UPLOADS_DIR = join(import.meta.dir, "../uploads");

function getAdminBootstrapConfig() {
  return {
    enabled: env.BOOTSTRAP_ADMIN,
    username: env.INITIAL_ADMIN_USERNAME?.trim(),
    password: env.INITIAL_ADMIN_PASSWORD?.trim(),
    email: env.INITIAL_ADMIN_EMAIL?.trim() || "mainauto@admin.local",
  };
}

export async function bootstrapInitialAdmin() {
  const config = getAdminBootstrapConfig();

  if (!config.enabled) {
    return;
  }

  if (!config.username || !config.password) {
    console.warn(
      "[bootstrap] BOOTSTRAP_ADMIN=true but INITIAL_ADMIN_USERNAME or INITIAL_ADMIN_PASSWORD is missing."
    );
    return;
  }

  try {
    const usersCount = await prisma.user.count();

    if (usersCount > 0) {
      console.info("[bootstrap] Initial admin skipped because users already exist.");
      return;
    }

    await auth.api.signUpEmail({
      body: {
        name: "Admin",
        email: config.email,
        password: config.password,
        username: config.username,
      },
    });

    console.info("[bootstrap] Initial admin user created.");
  } catch (err) {
    console.error("[bootstrap] Failed to create initial admin user:", err);
  }
}

async function downloadImage(url: string, filename: string): Promise<string> {
  try {
    if (!existsSync(UPLOADS_DIR)) {
      mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const filePath = join(UPLOADS_DIR, filename);
    // Skip if already downloaded
    if (existsSync(filePath)) return filename;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    await Bun.write(filePath, buffer);
    console.log(`[seed] Downloaded image: ${filename}`);
    return filename;
  } catch (err) {
    console.error(`[seed] Failed to download image ${url}:`, err);
    return filename; // Return filename anyway, image just won't exist
  }
}

export async function seedDemoData() {
  try {
    // Check if demo data already exists
    const existingVehicles = await prisma.vehicle.count();
    if (existingVehicles > 0) {
      return; // Already seeded
    }

    console.log("[seed] Creating demo data...");

    // Create customers
    const customers = await Promise.all([
      prisma.customer.create({
        data: {
          firstName: "Hans",
          lastName: "Müller",
          email: "hans.mueller@example.de",
          phone: "+49 89 123456",
          address: "Maximilianstraße 15",
          city: "München",
          zip: "80539",
          country: "Deutschland",
          notes: "Stammkunde seit 2019",
        },
      }),
      prisma.customer.create({
        data: {
          firstName: "Fatima",
          lastName: "Al-Rashid",
          email: "f.alrashid@example.de",
          phone: "+49 30 987654",
          address: "Unter den Linden 42",
          city: "Berlin",
          zip: "10117",
          country: "Deutschland",
        },
      }),
      prisma.customer.create({
        data: {
          firstName: "João",
          lastName: "Silva",
          email: "joao.silva@example.pt",
          phone: "+351 21 9876543",
          address: "Rua Augusta 88",
          city: "Lisboa",
          zip: "1100-048",
          country: "Portugal",
          notes: "Interessiert an Export-Fahrzeugen",
        },
      }),
      prisma.customer.create({
        data: {
          firstName: "Maria",
          lastName: "Becker",
          email: "m.becker@example.de",
          phone: "+49 221 456789",
          address: "Hohe Straße 5",
          city: "Köln",
          zip: "50667",
          country: "Deutschland",
        },
      }),
      prisma.customer.create({
        data: {
          firstName: "Stefan",
          lastName: "Horvath",
          email: "s.horvath@example.at",
          phone: "+43 1 5678901",
          address: "Mariahilfer Straße 120",
          city: "Wien",
          zip: "1070",
          country: "Österreich",
        },
      }),
    ]);

    console.log("[seed] Created 5 customers");

    // Helper to generate sequential vehicle numbers
    async function generateVehicleNumber(): Promise<string> {
      const year = new Date().getFullYear();
      const counter = await prisma.counter.upsert({
        where: { id: "vehicle" },
        update: { value: { increment: 1 } },
        create: { id: "vehicle", value: 1 },
      });
      const seq = String(counter.value).padStart(5, "0");
      return `FZ-${year}-${seq}`;
    }

    // Vehicle 1: BMW 520d
    const bmwImageFile = `seed-${randomUUID()}.jpg`;
    await downloadImage(
      "https://picsum.photos/seed/bmw520d/800/500",
      bmwImageFile
    );
    const bmw = await prisma.vehicle.create({
      data: {
        vehicleNumber: await generateVehicleNumber(),
        brand: "BMW",
        model: "520d",
        year: 2021,
        mileage: 45000,
        color: "Grau Metallic",
        fuelType: "Diesel",
        transmission: "Automatik",
        power: "190",
        powerKw: 140,
        co2Emission: 132,
        displacement: 1995,
        features: JSON.stringify([
          "Navi",
          "Leder",
          "Sitzheizung",
          "Parkassistent",
          "Head-Up Display",
          "Adaptive Cruise Control",
        ]),
        purchasePrice: 22000,
        sellingPrice: 27500,
        taxRate: 19,
        marginTaxed: false,
        status: "available",
      },
    });
    await prisma.vehicleImage.create({
      data: {
        vehicleId: bmw.id,
        url: `/api/uploads/${bmwImageFile}`,
        fileName: bmwImageFile,
        isPrimary: true,
      },
    });
    await prisma.workLogItem.createMany({
      data: [
        {
          vehicleId: bmw.id,
          description: "Innenreinigung durchführen",
          status: "done",
          assignee: "Thomas",
        },
        {
          vehicleId: bmw.id,
          description: "Ölwechsel und Service",
          status: "done",
          assignee: "Thomas",
        },
        {
          vehicleId: bmw.id,
          description: "Klimaanlage prüfen",
          status: "in_progress",
          assignee: "Klaus",
        },
      ],
    });

    // Vehicle 2: Mercedes-Benz E 300e
    const mbImageFile = `seed-${randomUUID()}.jpg`;
    await downloadImage(
      "https://picsum.photos/seed/mercedeseclass/800/500",
      mbImageFile
    );
    const mercedes = await prisma.vehicle.create({
      data: {
        vehicleNumber: await generateVehicleNumber(),
        brand: "Mercedes-Benz",
        model: "E 300e",
        year: 2022,
        mileage: 28000,
        color: "Schwarz Metallic",
        fuelType: "Hybrid",
        transmission: "Automatik",
        power: "320",
        powerKw: 235,
        co2Emission: 35,
        displacement: 1991,
        batteryCapacity: 13.5,
        electricRange: 54,
        batterySoh: 98,
        batteryType: "Lithium-Ionen",
        features: JSON.stringify([
          "Navi",
          "Leder",
          "AMG Line",
          "Panoramadach",
          "360 Kamera",
          "Burmester Sound",
        ]),
        purchasePrice: 38000,
        sellingPrice: 47900,
        taxRate: 19,
        marginTaxed: false,
        status: "available",
      },
    });
    await prisma.vehicleImage.create({
      data: {
        vehicleId: mercedes.id,
        url: `/api/uploads/${mbImageFile}`,
        fileName: mbImageFile,
        isPrimary: true,
      },
    });

    // Vehicle 3: VW Golf GTI
    const golfImageFile = `seed-${randomUUID()}.jpg`;
    await downloadImage(
      "https://picsum.photos/seed/vwgolfgti/800/500",
      golfImageFile
    );
    const golf = await prisma.vehicle.create({
      data: {
        vehicleNumber: await generateVehicleNumber(),
        brand: "Volkswagen",
        model: "Golf 8 GTI",
        year: 2022,
        mileage: 32000,
        color: "Tornadorot",
        fuelType: "Benzin",
        transmission: "Schaltgetriebe",
        power: "245",
        powerKw: 180,
        co2Emission: 148,
        displacement: 1984,
        features: JSON.stringify([
          "Navi",
          "Sitzheizung",
          "DCC Fahrwerk",
          "Harman Kardon",
          "Keyless Go",
        ]),
        purchasePrice: 26000,
        sellingPrice: 32500,
        taxRate: 19,
        marginTaxed: true,
        status: "reserved",
        customerId: customers[3].id,
      },
    });
    await prisma.vehicleImage.create({
      data: {
        vehicleId: golf.id,
        url: `/api/uploads/${golfImageFile}`,
        fileName: golfImageFile,
        isPrimary: true,
      },
    });

    // Vehicle 4: Porsche Taycan
    const porscheImageFile = `seed-${randomUUID()}.jpg`;
    await downloadImage(
      "https://picsum.photos/seed/porschetaycan/800/500",
      porscheImageFile
    );
    const taycan = await prisma.vehicle.create({
      data: {
        vehicleNumber: await generateVehicleNumber(),
        brand: "Porsche",
        model: "Taycan",
        year: 2023,
        mileage: 12000,
        color: "Kreidefarben",
        fuelType: "Elektro",
        transmission: "Automatik",
        power: "530",
        powerKw: 390,
        co2Emission: 0,
        batteryCapacity: 79.2,
        electricRange: 431,
        batterySoh: 99,
        batteryType: "Lithium-Ionen NMC",
        features: JSON.stringify([
          "Navi",
          "Leder",
          "Sport Chrono",
          "Panoramadach",
          "Matrix LED",
          "BOSE Sound",
          "22 Zoll Räder",
        ]),
        purchasePrice: 72000,
        sellingPrice: 89500,
        taxRate: 19,
        marginTaxed: false,
        exportEnabled: true,
        transportCostDomestic: 350,
        transportCostAbroad: 1200,
        customsDuties: 0,
        registrationFees: 850,
        repairCostsAbroad: 0,
        status: "available",
      },
    });
    await prisma.vehicleImage.create({
      data: {
        vehicleId: taycan.id,
        url: `/api/uploads/${porscheImageFile}`,
        fileName: porscheImageFile,
        isPrimary: true,
      },
    });

    // Vehicle 5: Audi A4 Avant
    const audiImageFile = `seed-${randomUUID()}.jpg`;
    await downloadImage(
      "https://picsum.photos/seed/audia4avant/800/500",
      audiImageFile
    );
    const audi = await prisma.vehicle.create({
      data: {
        vehicleNumber: await generateVehicleNumber(),
        brand: "Audi",
        model: "A4 Avant",
        year: 2020,
        mileage: 78000,
        color: "Navarra Blau",
        fuelType: "Diesel",
        transmission: "Automatik",
        power: "150",
        powerKw: 110,
        co2Emission: 126,
        displacement: 1968,
        hasDamage: true,
        damageDescription: "Kleiner Kratzer hinten links, bereits lackiert",
        damageAmount: 650,
        features: JSON.stringify([
          "Navi",
          "Einparkhilfe",
          "Sitzheizung",
          "Virtual Cockpit",
          "Anhängerkupplung",
        ]),
        purchasePrice: 18500,
        sellingPrice: 23900,
        taxRate: 19,
        marginTaxed: true,
        status: "sold",
        customerId: customers[0].id,
      },
    });
    await prisma.vehicleImage.create({
      data: {
        vehicleId: audi.id,
        url: `/api/uploads/${audiImageFile}`,
        fileName: audiImageFile,
        isPrimary: true,
      },
    });
    await prisma.workLogItem.createMany({
      data: [
        {
          vehicleId: audi.id,
          description: "Kratzer lackiert",
          status: "done",
          assignee: "Thomas",
        },
        {
          vehicleId: audi.id,
          description: "HU/AU Vorbereitung",
          status: "done",
          assignee: "Klaus",
        },
      ],
    });

    // Create a sale for the Audi
    await prisma.sale.create({
      data: {
        vehicleId: audi.id,
        customerId: customers[0].id,
        salePrice: 23900,
        taxRate: 19,
        saleDate: new Date("2024-11-15"),
        notes: "Barzahlung",
      },
    });

    console.log("[seed] Demo data created: 5 vehicles, 5 customers");
  } catch (err) {
    console.error("[seed] Failed to create demo data:", err);
  }
}
