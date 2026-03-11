// Vehicle types and utilities

export interface VehicleImage {
  id: string;
  vehicleId: string;
  url: string;
  isPrimary?: boolean;
  createdAt: string;
}

export interface VehicleDocument {
  id: string;
  vehicleId: string;
  name: string;
  url: string;
  createdAt: string;
}

export interface VehicleCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
}

export interface VehicleSale {
  id: string;
  vehicleId: string;
  customerId: string;
  salePrice: number;
  saleDate: string;
  customer?: VehicleCustomer;
}

export interface VehicleCost {
  id: string;
  vehicleId: string;
  costType: string;
  amount: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkLogItem {
  id: string;
  vehicleId: string;
  description: string;
  status: "open" | "in_progress" | "done";
  assignee?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  brand: string;
  model: string;
  year: number;
  firstRegistration?: string | null;
  mileage: number;
  vin: string;
  hsn?: string | null;
  tsn?: string | null;
  registrationDocNumber?: string | null;
  color: string;
  fuelType: string;
  transmission: string;
  power: number;
  features: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  marginTaxed: boolean;
  status: "available" | "reserved" | "sold";
  notes: string;
  customerId?: string | null;
  supplier?: string | null;
  images: VehicleImage[];
  documents: VehicleDocument[];
  customer?: VehicleCustomer | null;
  sales: VehicleSale[];
  costs: VehicleCost[];
  createdAt: string;
  updatedAt: string;
  // Technical
  co2Emission?: number | null;
  displacement?: number | null;
  powerKw?: number | null;
  bodyType?: string | null;
  doors?: number | null;
  seats?: number | null;
  driveType?: string | null;
  emissionClass?: string | null;
  // Damage
  hasDamage?: boolean;
  damageDescription?: string | null;
  damageAmount?: number | null;
  // Hybrid/Electric
  batteryCapacity?: number | null;
  electricRange?: number | null;
  batterySoh?: number | null;
  batteryType?: string | null;
  chargingTime?: number | null;
  connectorType?: string | null;
  // Export
  exportEnabled?: boolean;
  transportCostDomestic?: number | null;
  transportCostAbroad?: number | null;
  customsDuties?: number | null;
  registrationFees?: number | null;
  repairCostsAbroad?: number | null;
  // WorkLog
  workLog?: WorkLogItem[];
  // Supplier relation
  supplierId?: string | null;
  supplierRel?: { id: string; name: string; supplierType: string } | null;
  // History & Maintenance
  huDue?: string | null;
  previousOwners?: number | null;
  serviceDueKm?: number | null;
  serviceDueDate?: string | null;
  // Pricing
  dealerPrice?: number | null;
}

export type VehicleCreateInput = Omit<
  Vehicle,
  "id" | "images" | "documents" | "customer" | "sales" | "createdAt" | "updatedAt"
>;

// Format price as EUR
export function formatPrice(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

// Format mileage with separator
export function formatMileage(value: number): string {
  return `${value.toLocaleString("de-DE")} km`;
}

// Calculate gross price
export function calculateGrossPrice(
  netPrice: number,
  taxRate: number,
  marginTaxed: boolean
): number {
  if (marginTaxed) {
    return netPrice; // sellingPrice IS the gross price
  }
  return netPrice * (1 + taxRate / 100);
}

// Calculate net price from gross
export function calculateNetPrice(
  grossPrice: number,
  taxRate: number,
  marginTaxed: boolean
): number {
  if (marginTaxed) {
    return grossPrice;
  }
  return grossPrice / (1 + taxRate / 100);
}

// Calculate tax amount
export function calculateTaxAmount(
  netPrice: number,
  taxRate: number,
  marginTaxed: boolean
): number {
  if (marginTaxed) {
    return 0;
  }
  return netPrice * (taxRate / 100);
}

// Status labels and colors
export const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  available: {
    label: "Verfügbar",
    className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  },
  reserved: {
    label: "Reserviert",
    className: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  },
  sold: {
    label: "Verkauft",
    className: "bg-red-500/15 text-red-500 border-red-500/20",
  },
};

// Fuel type options
export const FUEL_TYPES = [
  { value: "Benzin", label: "Benzin" },
  { value: "Diesel", label: "Diesel" },
  { value: "Elektro", label: "Elektro" },
  { value: "Hybrid", label: "Hybrid" },
  { value: "Gas", label: "Gas" },
  { value: "Sonstige", label: "Sonstige" },
];

// Transmission options
export const TRANSMISSIONS = [
  { value: "Automatik", label: "Automatik" },
  { value: "Schaltgetriebe", label: "Schaltgetriebe" },
];

// Body type options
export const BODY_TYPES = [
  { value: "Limousine", label: "Limousine" },
  { value: "Kombi", label: "Kombi" },
  { value: "SUV", label: "SUV" },
  { value: "Coupé", label: "Coupé" },
  { value: "Cabrio", label: "Cabrio" },
  { value: "Van/Minivan", label: "Van/Minivan" },
  { value: "Transporter", label: "Transporter" },
  { value: "Pickup", label: "Pickup" },
];

// Drive type options
export const DRIVE_TYPES = [
  { value: "FWD", label: "FWD (Frontantrieb)" },
  { value: "RWD", label: "RWD (Hinterradantrieb)" },
  { value: "AWD", label: "AWD (Allradantrieb)" },
  { value: "4x4", label: "4x4" },
];

// Emission class options
export const EMISSION_CLASSES = [
  { value: "Euro 1", label: "Euro 1" },
  { value: "Euro 2", label: "Euro 2" },
  { value: "Euro 3", label: "Euro 3" },
  { value: "Euro 4", label: "Euro 4" },
  { value: "Euro 5", label: "Euro 5" },
  { value: "Euro 6", label: "Euro 6" },
  { value: "Euro 6d", label: "Euro 6d" },
  { value: "Euro 6d-TEMP", label: "Euro 6d-TEMP" },
];

// Status options
export const STATUS_OPTIONS = [
  { value: "available", label: "Verfügbar" },
  { value: "reserved", label: "Reserviert" },
  { value: "sold", label: "Verkauft" },
];

// Parse features from JSON string to array
export function parseFeatures(features: string): string[] {
  if (!features) return [];
  try {
    const parsed = JSON.parse(features);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // If not valid JSON, try comma-separated
    return features
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
  }
}

// Convert features array to JSON string
export function featuresToJson(features: string): string {
  const arr = features
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  return JSON.stringify(arr);
}

// Get the full URL for a file (image or document) stored on the backend
// Paths starting with /api/uploads/ need the backend base URL prefix in dev
export function getFileUrl(path: string): string {
  const base = import.meta.env.VITE_BACKEND_URL || "";
  if (path.startsWith("http")) return path;
  return `${base}${path}`;
}
