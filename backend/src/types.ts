import { z } from "zod";

// ─── Dealer / SaaS Schemas ───────────────────────────────────

export const PlatformRoleSchema = z.enum(["user", "platform_super_admin"]);
export const DealerStatusSchema = z.enum(["active", "suspended", "inactive"]);
export const DealerSetupStatusSchema = z.enum(["pending_setup", "ready_for_dns", "active", "suspended"]);
export const DealerDomainStatusSchema = z.enum(["pending_dns", "active", "failed", "disabled"]);
export const TenantStatusSchema = z.enum([
  "unknown",
  "pending_setup",
  "ready_for_dns",
  "active",
  "suspended",
  "inactive",
]);
export const DealerMembershipRoleSchema = z.enum(["dealer_owner", "dealer_admin", "staff"]);
export const DealerSubscriptionStatusSchema = z.enum([
  "active",
  "trialing",
  "past_due",
  "suspended",
  "canceled",
]);

export const FeatureEntitlementsSchema = z.record(z.string(), z.boolean()).default({});

export const DealerSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: DealerStatusSchema,
  setupStatus: DealerSetupStatusSchema,
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DealerSettingsSchema = z.object({
  dealerId: z.string(),
  displayName: z.string().nullable().optional(),
  legalName: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  supportEmail: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  legalRepresentative: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  iban: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  faviconUrl: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  loginHeadline: z.string().nullable().optional(),
  documentFooterText: z.string().nullable().optional(),
  documentLegalText: z.string().nullable().optional(),
  purchaseTerms: z.string().nullable().optional(),
  saleTerms: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const DealerDomainSchema = z.object({
  id: z.string(),
  dealerId: z.string(),
  host: z.string(),
  status: DealerDomainStatusSchema,
  isPrimary: z.boolean(),
  verificationToken: z.string().nullable().optional(),
  verifiedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DealerMembershipSchema = z.object({
  id: z.string(),
  dealerId: z.string(),
  userId: z.string(),
  role: DealerMembershipRoleSchema,
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PlanSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  monthlyPriceCents: z.number().int(),
  featureEntitlements: FeatureEntitlementsSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DealerSubscriptionSchema = z.object({
  id: z.string(),
  dealerId: z.string(),
  planId: z.string(),
  status: DealerSubscriptionStatusSchema,
  featureOverrides: FeatureEntitlementsSchema.optional(),
  billingNotes: z.string().nullable().optional(),
  startsAt: z.string(),
  endsAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  plan: PlanSchema.optional(),
});

export const DealerSettingsUpdateSchema = DealerSettingsSchema.omit({
  dealerId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const AdminDealerCreateSchema = z.object({
  name: z.string().min(2, "Name ist erforderlich"),
  slug: z.string().trim().min(2).optional(),
  status: DealerStatusSchema.default("active"),
  setupStatus: DealerSetupStatusSchema.default("pending_setup").optional(),
  owner: z.object({
    name: z.string().min(2, "Name ist erforderlich"),
    email: z.string().email("Gueltige E-Mail erforderlich"),
    username: z.string().min(3, "Benutzername ist erforderlich"),
    password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben"),
  }),
});

export const AdminDealerUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().trim().min(2).optional(),
  status: DealerStatusSchema.optional(),
  setupStatus: DealerSetupStatusSchema.optional(),
  owner: z
    .object({
      name: z.string().min(2, "Name ist erforderlich").optional(),
      email: z.string().email("Gueltige E-Mail erforderlich").optional(),
      username: z.string().min(3, "Benutzername ist erforderlich").nullable().optional(),
      password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben").optional(),
    })
    .optional(),
});

export const DealerTeamMemberCreateSchema = z.object({
  name: z.string().min(2, "Name ist erforderlich"),
  email: z.string().email("Gueltige E-Mail erforderlich"),
  username: z.string().min(3, "Benutzername ist erforderlich"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben"),
  role: DealerMembershipRoleSchema.default("staff"),
});

export const DealerTeamRoleUpdateSchema = z.object({
  role: DealerMembershipRoleSchema.optional(),
  name: z.string().min(2, "Name ist erforderlich").optional(),
  email: z.string().email("Gueltige E-Mail erforderlich").optional(),
  username: z.string().min(3, "Benutzername ist erforderlich").nullable().optional(),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben").optional(),
  isActive: z.boolean().optional(),
});

export const DealerSubscriptionUpdateSchema = z.object({
  planId: z.string().min(1, "Plan ist erforderlich"),
  status: DealerSubscriptionStatusSchema.default("active"),
  featureOverrides: FeatureEntitlementsSchema.optional(),
  billingNotes: z.string().optional(),
  endsAt: z.string().nullable().optional(),
});

export const DealerDomainCreateSchema = z.object({
  host: z
    .string()
    .trim()
    .min(4, "Host ist erforderlich")
    .transform((value) => value.toLowerCase()),
});

export const DealerDomainVerifySchema = z.object({
  status: DealerDomainStatusSchema.default("pending_dns"),
});

export const DealerDomainActivateSchema = z.object({
  status: z.enum(["active", "disabled", "failed"]).default("active"),
  isPrimary: z.boolean().default(true),
});

export const PublicTenantContextSchema = z.object({
  displayName: z.string(),
  logoUrl: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  primaryColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  loginHeadline: z.string().nullable(),
  supportEmail: z.string().nullable(),
  tenantStatus: TenantStatusSchema,
  dealer: DealerSchema.nullable(),
  activeDomain: DealerDomainSchema.nullable(),
});

export const OnboardingInquiryCreateSchema = z.object({
  businessName: z.string().min(2, "Firmenname ist erforderlich"),
  contactName: z.string().min(2, "Ansprechpartner ist erforderlich"),
  email: z.string().email("Gueltige E-Mail erforderlich"),
  phone: z.string().trim().optional(),
  website: z.string().trim().optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const OnboardingInquirySchema = z.object({
  id: z.string(),
  businessName: z.string(),
  contactName: z.string(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const OnboardingInquiryStatusUpdateSchema = z.object({
  status: z.enum(["new", "in_progress", "converted", "archived"]),
});

export const SessionContextSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    username: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    platformRole: PlatformRoleSchema.default("user"),
  }),
  dealer: DealerSchema.nullable(),
  dealerRole: DealerMembershipRoleSchema.nullable(),
  dealerSettings: DealerSettingsSchema.nullable(),
  activeDomain: DealerDomainSchema.nullable().optional(),
  tenantStatus: TenantStatusSchema.default("unknown"),
  resolvedHost: z.string().nullable().optional(),
  entitlements: FeatureEntitlementsSchema,
  subscription: DealerSubscriptionSchema.nullable().optional(),
});

export type FeatureEntitlements = z.infer<typeof FeatureEntitlementsSchema>;
export type Dealer = z.infer<typeof DealerSchema>;
export type DealerSettings = z.infer<typeof DealerSettingsSchema>;
export type DealerDomain = z.infer<typeof DealerDomainSchema>;
export type DealerMembership = z.infer<typeof DealerMembershipSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type DealerSubscription = z.infer<typeof DealerSubscriptionSchema>;
export type PublicTenantContext = z.infer<typeof PublicTenantContextSchema>;
export type OnboardingInquiry = z.infer<typeof OnboardingInquirySchema>;
export type SessionContext = z.infer<typeof SessionContextSchema>;

// ─── Vehicle Schemas ─────────────────────────────────────────

export const VehicleCreateSchema = z.object({
  vehicleNumber: z.string().trim().min(1, "Vehicle number is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().int().min(1900).max(2100).optional(),
  mileage: z.number().int().min(0),
  vin: z.string().optional(),
  hsn: z.string().optional(),
  tsn: z.string().optional(),
  registrationDocNumber: z.string().optional(),
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
  internalNotes: z.string().optional(),
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
  hsn: z.string().optional(),
  tsn: z.string().optional(),
  registrationDocNumber: z.string().optional(),
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
  internalNotes: z.string().optional(),
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

// ─── Vehicle Brief Extraction Schemas ──────────────────────────

export const VehicleBriefDocumentTypeSchema = z.enum([
  "teil1",
  "teil2",
  "mixed",
  "unknown",
]);

export const VehicleBriefExtractFieldsSchema = z.object({
  vin: z.string().optional(),
  firstRegistration: z.string().optional(), // ISO date string (YYYY-MM-DD)
  color: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  hsn: z.string().optional(),
  tsn: z.string().optional(),
  registrationDocNumber: z.string().optional(),
  fuelType: z.string().optional(),
  co2Emission: z.number().optional(),
  displacement: z.number().int().optional(),
  power: z.number().optional(),
  powerKw: z.number().optional(),
  bodyType: z.string().optional(),
  driveType: z.string().optional(),
  emissionClass: z.string().optional(),
  previousOwners: z.number().int().optional(),
});

export const VehicleBriefExtractResponseSchema = z.object({
  documentType: VehicleBriefDocumentTypeSchema.default("unknown"),
  fields: VehicleBriefExtractFieldsSchema,
  warnings: z.array(z.string()).default([]),
  detectedFieldCount: z.number().int().min(0),
});

export type VehicleBriefDocumentType = z.infer<typeof VehicleBriefDocumentTypeSchema>;
export type VehicleBriefExtractFields = z.infer<typeof VehicleBriefExtractFieldsSchema>;
export type VehicleBriefExtractResponse = z.infer<typeof VehicleBriefExtractResponseSchema>;

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
  idDocumentType: z.string().optional(),
  idDocumentNumber: z.string().optional(),
  idDocumentValidUntil: z.string().optional(),
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
  idDocumentType: z.string().optional(),
  idDocumentNumber: z.string().optional(),
  idDocumentValidUntil: z.string().optional(),
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

export const DocumentTypeSchema = z.enum(["offer", "price-tag", "contract", "purchase-contract"]);

export const DocumentGenerateSchema = z.object({
  type: DocumentTypeSchema,
  vehicleId: z.string().min(1, "Vehicle ID is required"),
  customerId: z.string().optional(),
});

export type DocumentGenerate = z.infer<typeof DocumentGenerateSchema>;

export const DocumentPartySourceSchema = z.enum(["customer", "supplier", "manual"]);

export const DocumentManualPartySchema = z.object({
  firstName: z.string().trim().min(1, "Vorname ist erforderlich"),
  lastName: z.string().trim().min(1, "Nachname ist erforderlich"),
  company: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  taxId: z.string().optional(),
});

export const PurchaseContractGenerateSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle ID is required"),
  sellerSource: DocumentPartySourceSchema,
  sellerId: z.string().optional(),
  manualSeller: DocumentManualPartySchema.optional(),
}).superRefine((value, ctx) => {
  if (value.sellerSource === "manual") {
    if (!value.manualSeller) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["manualSeller"],
        message: "Verkäuferdaten sind erforderlich",
      });
    }
    return;
  }

  if (!value.sellerId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sellerId"],
      message: "Verkäufer-ID ist erforderlich",
    });
  }
});

export type PurchaseContractGenerate = z.infer<typeof PurchaseContractGenerateSchema>;

// ─── Handover Protocol Schemas ───────────────────────────────

const OptionalNonNegativeIntegerSchema = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z.number().int().min(0).nullable());

export const HandoverProtocolExteriorStateSchema = z.enum([
  "washed",
  "lightly_soiled",
  "heavily_soiled",
]).or(z.literal(""));

export const HandoverProtocolInteriorStateSchema = z.enum([
  "clean",
  "lightly_soiled",
  "heavily_soiled",
]).or(z.literal(""));

export const HandoverProtocolFuelLevelSchema = z.enum([
  "empty",
  "quarter",
  "half",
  "three_quarters",
  "full",
]).or(z.literal(""));

export const HandoverProtocolWheelConditionSchema = z.enum([
  "new",
  "like_new",
  "used",
  "worn",
]).or(z.literal(""));

export const HandoverProtocolWheelSetSchema = z.object({
  summer: z.boolean().default(false),
  winter: z.boolean().default(false),
  allSeason: z.boolean().default(false),
  alloy: z.boolean().default(false),
  steel: z.boolean().default(false),
  spareWheel: z.boolean().default(false),
  condition: HandoverProtocolWheelConditionSchema.default(""),
});

export const HandoverProtocolPartySchema = z.object({
  name: z.string().default(""),
  company: z.string().default(""),
  street: z.string().default(""),
  postalCodeCity: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
});

export const HandoverProtocolDamageViewSchema = z.enum(["left-front", "right-rear"]);

export const HandoverProtocolDamageMarkerSchema = z.object({
  id: z.string().default(""),
  view: HandoverProtocolDamageViewSchema,
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export const HandoverProtocolSchema = z.object({
  vehicle: z.object({
    licensePlate: z.string().default(""),
    manufacturerModelType: z.string().default(""),
    color: z.string().default(""),
    fuelType: z.string().default(""),
    mileage: z.string().default(""),
    vin: z.string().default(""),
    internalVehicleNumber: z.string().default(""),
  }).default({
    licensePlate: "",
    manufacturerModelType: "",
    color: "",
    fuelType: "",
    mileage: "",
    vin: "",
    internalVehicleNumber: "",
  }),
  handover: z.object({
    date: z.string().default(""),
    time: z.string().default(""),
    location: z.string().default(""),
  }).default({
    date: "",
    time: "",
    location: "",
  }),
  giver: HandoverProtocolPartySchema.default({
    name: "",
    company: "",
    street: "",
    postalCodeCity: "",
    email: "",
    phone: "",
  }),
  receiverCustomerId: z.string().nullable().default(null),
  receiver: HandoverProtocolPartySchema.default({
    name: "",
    company: "",
    street: "",
    postalCodeCity: "",
    email: "",
    phone: "",
  }),
  condition: z.object({
    exterior: HandoverProtocolExteriorStateSchema.default(""),
    interior: HandoverProtocolInteriorStateSchema.default(""),
    fuelLevel: HandoverProtocolFuelLevelSchema.default(""),
  }).default({
    exterior: "",
    interior: "",
    fuelLevel: "",
  }),
  items: z.object({
    keys: z.object({
      checked: z.boolean().default(false),
      count: OptionalNonNegativeIntegerSchema.default(null),
    }),
    serviceBook: z.boolean().default(false),
    vehicleFolder: z.boolean().default(false),
    chargingCableType2: z.boolean().default(false),
    chargingCableSchuko: z.boolean().default(false),
    registrationPart1: z.boolean().default(false),
    registrationPart2: z.boolean().default(false),
    cocCertificate: z.boolean().default(false),
    parkingHeaterRemote: z.boolean().default(false),
    warningTriangle: z.boolean().default(false),
    safetyVest: z.boolean().default(false),
    firstAidKit: z.boolean().default(false),
    other: z.string().default(""),
  }).default({
    keys: {
      checked: false,
      count: null,
    },
    serviceBook: false,
    vehicleFolder: false,
    chargingCableType2: false,
    chargingCableSchuko: false,
    registrationPart1: false,
    registrationPart2: false,
    cocCertificate: false,
    parkingHeaterRemote: false,
    warningTriangle: false,
    safetyVest: false,
    firstAidKit: false,
    other: "",
  }),
  mountedWheels: HandoverProtocolWheelSetSchema.default({
    summer: false,
    winter: false,
    allSeason: false,
    alloy: false,
    steel: false,
    spareWheel: false,
    condition: "",
  }),
  includedWheels: HandoverProtocolWheelSetSchema.default({
    summer: false,
    winter: false,
    allSeason: false,
    alloy: false,
    steel: false,
    spareWheel: false,
    condition: "",
  }),
  damage: z.object({
    markers: z.array(HandoverProtocolDamageMarkerSchema).default([]),
    remark: z.string().default(""),
  }).default({
    markers: [],
    remark: "",
  }),
});

export const HandoverProtocolLoadResponseSchema = z.object({
  exists: z.boolean(),
  updatedAt: z.string().nullable(),
  data: HandoverProtocolSchema,
});

export const HandoverProtocolDocumentGenerateSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle ID is required"),
  data: HandoverProtocolSchema,
});

export type HandoverProtocol = z.infer<typeof HandoverProtocolSchema>;
export type HandoverProtocolLoadResponse = z.infer<typeof HandoverProtocolLoadResponseSchema>;
export type HandoverProtocolDocumentGenerate = z.infer<typeof HandoverProtocolDocumentGenerateSchema>;

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
  street: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
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

export const FinancesCostBreakdownItemSchema = z.object({
  label: z.string(),
  amount: z.number(),
  category: z.enum(["manual", "export"]),
});

export const FinancesSaleRowSchema = z.object({
  id: z.string(),
  saleDate: z.string(),
  vehicleNumber: z.string(),
  brand: z.string(),
  model: z.string(),
  purchasePrice: z.number(),
  manualAdditionalCosts: z.number(),
  exportAdditionalCosts: z.number(),
  additionalCosts: z.number(),
  costBreakdown: z.array(FinancesCostBreakdownItemSchema),
  salePrice: z.number(),
  profit: z.number(),
  customerName: z.string(),
});

export const FinancesDataSchema = z.object({
  vehiclesBought: z.number(),
  totalPurchaseCost: z.number(),
  totalManualCosts: z.number(),
  totalExportCosts: z.number(),
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
