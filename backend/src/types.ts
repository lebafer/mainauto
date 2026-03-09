import { z } from "zod";

// ─── Vehicle Schemas ─────────────────────────────────────────

export const VehicleCreateSchema = z.object({
  vehicleNumber: z.string().trim().min(1, "Vehicle number is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().int().min(1900).max(2100).optional(),
  mileage: z.number().int().min(0),
  vin: z.string().optional(),
  color: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  power: z.union([z.number(), z.string()]).optional().transform(v => v !== undefined && v !== "" ? Number(v) : undefined),
  features: z.string().optional(), // JSON string of features array
  purchasePrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(19.0),
  marginTaxed: z.boolean().default(false),
  status: z.enum(["available", "reserved", "sold"]).default("available"),
  notes: z.string().optional(),
  customerId: z.string().nullable().optional(),
  // Technical details
  co2Emission: z.number().optional(),
  displacement: z.number().int().optional(),
  powerKw: z.number().optional(),
  // Damage
  hasDamage: z.boolean().default(false),
  damageDescription: z.string().optional(),
  damageAmount: z.number().optional(),
  // Hybrid/Elektro
  batteryCapacity: z.number().optional(),
  electricRange: z.number().int().optional(),
  batterySoh: z.number().optional(),
  batteryType: z.string().optional(),
  // Export
  exportEnabled: z.boolean().default(false),
  transportCostDomestic: z.number().optional(),
  transportCostAbroad: z.number().optional(),
  customsDuties: z.number().optional(),
  registrationFees: z.number().optional(),
  repairCostsAbroad: z.number().optional(),
  // Additional
  firstRegistration: z.string().optional(), // ISO date string (Erstzulassung)
  supplier: z.string().optional(),
  chargingTime: z.number().int().optional(),
  connectorType: z.string().optional(),
  // Supplier relation
  supplierId: z.string().optional().nullable(),
  // Inspection / Service
  huDue: z.string().optional(),           // ISO date string (month+year)
  previousOwners: z.number().int().min(0).optional(),
  serviceDueKm: z.number().int().optional(),
  serviceDueDate: z.string().optional(),  // ISO date string
  // Body / Configuration
  bodyType: z.string().optional(),        // Karosserieform z.B. Limousine, Kombi, SUV
  doors: z.number().int().min(0).optional(),
  seats: z.number().int().min(0).optional(),
  driveType: z.string().optional(),       // Antriebsart z.B. FWD, RWD, AWD, 4x4
  emissionClass: z.string().optional(),   // Schadstoffklasse z.B. Euro 6
  dealerPrice: z.number().optional(),     // Händlerpreis EUR
});

export const VehicleUpdateSchema = z.object({
  vehicleNumber: z.string().trim().min(1).optional(),
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  mileage: z.number().int().min(0).optional(),
  vin: z.string().optional(),
  color: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  power: z.union([z.number(), z.string()]).optional().transform(v => v !== undefined && v !== "" ? Number(v) : undefined),
  features: z.string().optional(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  marginTaxed: z.boolean().optional(),
  status: z.enum(["available", "reserved", "sold"]).optional(),
  notes: z.string().optional(),
  customerId: z.string().nullable().optional(),
  // Technical details
  co2Emission: z.number().optional(),
  displacement: z.number().int().optional(),
  powerKw: z.number().optional(),
  // Damage
  hasDamage: z.boolean().optional(),
  damageDescription: z.string().optional(),
  damageAmount: z.number().optional(),
  // Hybrid/Elektro
  batteryCapacity: z.number().optional(),
  electricRange: z.number().int().optional(),
  batterySoh: z.number().optional(),
  batteryType: z.string().optional(),
  // Export
  exportEnabled: z.boolean().optional(),
  transportCostDomestic: z.number().optional(),
  transportCostAbroad: z.number().optional(),
  customsDuties: z.number().optional(),
  registrationFees: z.number().optional(),
  repairCostsAbroad: z.number().optional(),
  // Additional
  firstRegistration: z.string().optional(), // ISO date string (Erstzulassung)
  supplier: z.string().optional(),
  chargingTime: z.number().int().optional(),
  connectorType: z.string().optional(),
  // Supplier relation
  supplierId: z.string().optional().nullable(),
  // Inspection / Service
  huDue: z.string().optional(),           // ISO date string (month+year)
  previousOwners: z.number().int().min(0).optional(),
  serviceDueKm: z.number().int().optional(),
  serviceDueDate: z.string().optional(),  // ISO date string
  // Body / Configuration
  bodyType: z.string().optional(),        // Karosserieform z.B. Limousine, Kombi, SUV
  doors: z.number().int().min(0).optional(),
  seats: z.number().int().min(0).optional(),
  driveType: z.string().optional(),       // Antriebsart z.B. FWD, RWD, AWD, 4x4
  emissionClass: z.string().optional(),   // Schadstoffklasse z.B. Euro 6
  dealerPrice: z.number().optional(),     // Händlerpreis EUR
});

export type VehicleCreate = z.infer<typeof VehicleCreateSchema>;
export type VehicleUpdate = z.infer<typeof VehicleUpdateSchema>;

// ─── Customer Schemas ────────────────────────────────────────

export const CustomerCreateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  company: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  customerType: z.enum(["privat", "gewerblich"]).default("privat").optional(),
});

export const CustomerUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  company: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  customerType: z.enum(["privat", "gewerblich"]).optional(),
});

export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;

// ─── Sale Schemas ────────────────────────────────────────────

export const SaleCreateSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle ID is required"),
  customerId: z.string().min(1, "Customer ID is required"),
  salePrice: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(19.0),
  saleDate: z.string().optional(), // ISO date string, defaults to now
  notes: z.string().optional(),
});

export type SaleCreate = z.infer<typeof SaleCreateSchema>;

// ─── Vehicle Cost Schemas ─────────────────────────────────────

export const VehicleCostCreateSchema = z.object({
  costType: z.string().min(1, "Cost type is required"),
  amount: z.number().positive("Amount must be positive"),
  notes: z.string().optional(),
});

export type VehicleCostCreate = z.infer<typeof VehicleCostCreateSchema>;

// ─── Document Generation Schemas ─────────────────────────────

export const DocumentGenerateSchema = z.object({
  type: z.enum(["offer", "price-tag", "contract"]),
  vehicleId: z.string().min(1, "Vehicle ID is required"),
  customerId: z.string().optional(),
});

export type DocumentGenerate = z.infer<typeof DocumentGenerateSchema>;

// ─── WorkLog Schemas ──────────────────────────────────────────

export const WorkLogItemCreateSchema = z.object({
  description: z.string().min(1, "Beschreibung ist erforderlich"),
  status: z.enum(["open", "in_progress", "done"]).default("open"),
  assignee: z.string().optional(),
  dueDate: z.string().optional(), // ISO date string
});

export const WorkLogItemUpdateSchema = z.object({
  description: z.string().min(1).optional(),
  status: z.enum(["open", "in_progress", "done"]).optional(),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
});

export type WorkLogItemCreate = z.infer<typeof WorkLogItemCreateSchema>;
export type WorkLogItemUpdate = z.infer<typeof WorkLogItemUpdateSchema>;

// ─── Supplier Schemas (full DB model) ────────────────────────

export const SupplierCreateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  supplierType: z.enum(["privat", "gewerblich"]).default("gewerblich"),
  address: z.string().optional(),
  country: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  email: z.string().email("Ungültige E-Mail-Adresse").optional().or(z.literal("")),
  website: z.string().optional(),
  iban: z.string().optional(),
  notes: z.string().optional(),
});

export const SupplierUpdateSchema = SupplierCreateSchema.partial();

export type SupplierCreate = z.infer<typeof SupplierCreateSchema>;
export type SupplierUpdate = z.infer<typeof SupplierUpdateSchema>;

// ─── Finances Schemas ─────────────────────────────────────────

export const FinancesSaleRowSchema = z.object({
  id: z.string(),
  saleDate: z.string(),
  vehicleNumber: z.string(),
  brand: z.string(),
  model: z.string(),
  purchasePrice: z.number(),
  additionalCosts: z.number(),
  salePrice: z.number(),
  profit: z.number(),
  customerName: z.string(),
});

export const FinancesDataSchema = z.object({
  vehiclesBought: z.number(),
  totalPurchaseCost: z.number(),
  totalAdditionalCosts: z.number(),
  vehiclesSold: z.number(),
  totalRevenue: z.number(),
  totalProfit: z.number(),
  profitableSales: z.number(),
  lossSales: z.number(),
  vehiclesInStock: z.number(),
  stockValue: z.number(),
  bestSale: z
    .object({
      vehicleNumber: z.string(),
      brand: z.string(),
      model: z.string(),
      profit: z.number(),
    })
    .nullable(),
  sales: z.array(FinancesSaleRowSchema),
});

export type FinancesSaleRow = z.infer<typeof FinancesSaleRowSchema>;
export type FinancesData = z.infer<typeof FinancesDataSchema>;
