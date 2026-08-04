import { z } from "zod";
import { MAX_MONEY_AMOUNT } from "./lib/money";

const IsoDateSchema = z.iso.date();
const IsoDateTimeSchema = z.iso.datetime({ offset: true });
const OptionalIsoDateSchema = z.union([IsoDateSchema, IsoDateTimeSchema]);
const EmptyStringToUndefinedOptionalIsoDateSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  OptionalIsoDateSchema.optional()
);
const LimitedTextSchema = (max: number) => z.string().trim().max(max);
const MoneyAmountSchema = z.number().finite().min(0).max(MAX_MONEY_AMOUNT);

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
export const SafeDealerDomainSchema = DealerDomainSchema.omit({
  verificationToken: true,
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
  stripePriceMonthlyId: z.string().nullable().optional(),
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
  stripeCustomerId: z.string().nullable().optional(),
  stripeSubscriptionId: z.string().nullable().optional(),
  stripeCheckoutSessionId: z.string().nullable().optional(),
  stripePriceId: z.string().nullable().optional(),
  complimentaryAccess: z.boolean().default(false),
  featureOverrides: FeatureEntitlementsSchema.optional(),
  billingNotes: z.string().nullable().optional(),
  trialEndsAt: z.string().nullable().optional(),
  currentPeriodEndsAt: z.string().nullable().optional(),
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
    password: z.string().min(12, "Passwort muss mindestens 12 Zeichen haben"),
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
      password: z.string().min(12, "Passwort muss mindestens 12 Zeichen haben").optional(),
    })
    .optional(),
});

export const DealerTeamMemberCreateSchema = z.object({
  name: z.string().min(2, "Name ist erforderlich"),
  email: z.string().email("Gueltige E-Mail erforderlich"),
  username: z.string().min(3, "Benutzername ist erforderlich"),
  password: z.string().min(12, "Passwort muss mindestens 12 Zeichen haben"),
  role: DealerMembershipRoleSchema.default("staff"),
});

export const DealerTeamRoleUpdateSchema = z.object({
  role: DealerMembershipRoleSchema.optional(),
  name: z.string().min(2, "Name ist erforderlich").optional(),
  email: z.string().email("Gueltige E-Mail erforderlich").optional(),
  username: z.string().min(3, "Benutzername ist erforderlich").nullable().optional(),
  password: z.string().min(12, "Passwort muss mindestens 12 Zeichen haben").optional(),
  isActive: z.boolean().optional(),
});

export const DealerSubscriptionUpdateSchema = z.object({
  planId: z.string().min(1, "Plan ist erforderlich"),
  status: DealerSubscriptionStatusSchema.default("active"),
  complimentaryAccess: z.boolean().optional(),
  featureOverrides: FeatureEntitlementsSchema.optional(),
  billingNotes: z.string().optional(),
  endsAt: z.string().nullable().optional(),
});

export const DealerSubscriptionComplimentaryUpdateSchema = z.object({
  complimentaryAccess: z.boolean(),
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
  activeDomain: SafeDealerDomainSchema.nullable(),
});

export const PublicPlanSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  monthlyPriceCents: z.number().int(),
  trialDays: z.number().int(),
  featureEntitlements: FeatureEntitlementsSchema,
  stripeConfigured: z.boolean(),
});

export const PublicSignupSchema = z.object({
  companyName: z.string().trim().min(2, "Firmenname ist erforderlich").max(160),
  ownerName: z.string().trim().min(2, "Name ist erforderlich").max(160),
  email: z.string().email("Gueltige E-Mail erforderlich"),
  username: z.string().trim().min(3, "Benutzername ist erforderlich").max(80),
  password: z.string().min(12, "Passwort muss mindestens 12 Zeichen haben").max(200),
  planSlug: z.enum(["standard", "pro"]),
});

export const PublicSignupResponseSchema = z.object({
  dealerId: z.string(),
  planSlug: z.enum(["standard", "pro"]),
  subscriptionStatus: DealerSubscriptionStatusSchema,
  trialEndsAt: z.string(),
});

export const BillingCheckoutCreateSchema = z.object({
  planSlug: z.enum(["standard", "pro"]),
  returnPath: z.string().trim().optional(),
});

export const BillingCheckoutResponseSchema = z.object({
  url: z.string().url(),
});

export const BillingPortalCreateSchema = z.object({
  returnPath: z.string().trim().optional(),
});

export const BillingPortalResponseSchema = z.object({
  url: z.string().url(),
});

export const BillingStateSchema = z.object({
  status: z.union([DealerSubscriptionStatusSchema, z.literal("none")]),
  trialEndsAt: z.string().nullable(),
  currentPeriodEndsAt: z.string().nullable(),
  isComplimentary: z.boolean().default(false),
  requiresPayment: z.boolean(),
  canAccessApp: z.boolean(),
});

export const StripeCheckoutMetadataSchema = z.object({
  dealerId: z.string(),
  planSlug: z.enum(["standard", "pro"]),
  dealerSubscriptionId: z.string().optional(),
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
  activeDomain: SafeDealerDomainSchema.nullable().optional(),
  tenantStatus: TenantStatusSchema.default("unknown"),
  resolvedHost: z.string().nullable().optional(),
  entitlements: FeatureEntitlementsSchema,
  billing: BillingStateSchema,
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
export type PublicPlan = z.infer<typeof PublicPlanSchema>;
export type SessionContext = z.infer<typeof SessionContextSchema>;

// ─── Vehicle Schemas ─────────────────────────────────────────

export const VehicleCreateSchema = z.object({
  vehicleNumber: z.string().trim().min(1, "Vehicle number is required").max(80),
  brand: z.string().trim().min(1, "Brand is required").max(120),
  model: z.string().trim().min(1, "Model is required").max(160),
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
  purchasePrice: MoneyAmountSchema,
  sellingPrice: MoneyAmountSchema,
  taxRate: z.number().min(0).max(100).default(19.0),
  marginTaxed: z.boolean().default(false),
  isPrivate: z.boolean().default(false),
  status: z.enum(["available", "reserved", "sold"]).default("available"),
  notes: LimitedTextSchema(10_000).optional(),
  internalNotes: LimitedTextSchema(10_000).optional(),
  customerId: z.string().nullable().optional(),
  // Technical details
  co2Emission: z.number().optional(),
  displacement: z.number().int().optional(),
  powerKw: z.number().optional(),
  // Damage
  hasDamage: z.boolean().default(false),
  damageDescription: z.string().optional(),
  damageAmount: MoneyAmountSchema.optional(),
  // Hybrid/Elektro
  batteryCapacity: z.number().optional(),
  electricRange: z.number().int().optional(),
  batterySoh: z.number().optional(),
  batteryType: z.string().optional(),
  // Export
  exportEnabled: z.boolean().default(false),
  transportCostDomestic: MoneyAmountSchema.optional(),
  transportCostAbroad: MoneyAmountSchema.optional(),
  customsDuties: MoneyAmountSchema.optional(),
  registrationFees: MoneyAmountSchema.optional(),
  repairCostsAbroad: MoneyAmountSchema.optional(),
  // Additional
  firstRegistration: OptionalIsoDateSchema.optional(),
  supplier: z.string().optional(),
  chargingTime: z.number().int().optional(),
  connectorType: z.string().optional(),
  // Supplier relation
  supplierId: z.string().optional().nullable(),
  // Inspection / Service
  huDue: OptionalIsoDateSchema.optional(),
  previousOwners: z.number().int().min(0).optional(),
  serviceDueKm: z.number().int().optional(),
  serviceDueDate: OptionalIsoDateSchema.optional(),
  // Body / Configuration
  bodyType: z.string().optional(),        // Karosserieform z.B. Limousine, Kombi, SUV
  doors: z.number().int().min(0).optional(),
  seats: z.number().int().min(0).optional(),
  driveType: z.string().optional(),       // Antriebsart z.B. FWD, RWD, AWD, 4x4
  emissionClass: z.string().optional(),   // Schadstoffklasse z.B. Euro 6
  dealerPrice: MoneyAmountSchema.optional(),     // Händlerpreis EUR
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
  purchasePrice: MoneyAmountSchema.optional(),
  sellingPrice: MoneyAmountSchema.optional(),
  taxRate: z.number().min(0).max(100).optional(),
  marginTaxed: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  status: z.enum(["available", "reserved", "sold"]).optional(),
  notes: LimitedTextSchema(10_000).optional(),
  internalNotes: LimitedTextSchema(10_000).optional(),
  customerId: z.string().nullable().optional(),
  // Technical details
  co2Emission: z.number().optional(),
  displacement: z.number().int().optional(),
  powerKw: z.number().optional(),
  // Damage
  hasDamage: z.boolean().optional(),
  damageDescription: z.string().optional(),
  damageAmount: MoneyAmountSchema.optional(),
  // Hybrid/Elektro
  batteryCapacity: z.number().optional(),
  electricRange: z.number().int().optional(),
  batterySoh: z.number().optional(),
  batteryType: z.string().optional(),
  // Export
  exportEnabled: z.boolean().optional(),
  transportCostDomestic: MoneyAmountSchema.optional(),
  transportCostAbroad: MoneyAmountSchema.optional(),
  customsDuties: MoneyAmountSchema.optional(),
  registrationFees: MoneyAmountSchema.optional(),
  repairCostsAbroad: MoneyAmountSchema.optional(),
  // Additional
  firstRegistration: OptionalIsoDateSchema.optional(),
  supplier: z.string().optional(),
  chargingTime: z.number().int().optional(),
  connectorType: z.string().optional(),
  // Supplier relation
  supplierId: z.string().optional().nullable(),
  // Inspection / Service
  huDue: OptionalIsoDateSchema.optional(),
  previousOwners: z.number().int().min(0).optional(),
  serviceDueKm: z.number().int().optional(),
  serviceDueDate: OptionalIsoDateSchema.optional(),
  // Body / Configuration
  bodyType: z.string().optional(),        // Karosserieform z.B. Limousine, Kombi, SUV
  doors: z.number().int().min(0).optional(),
  seats: z.number().int().min(0).optional(),
  driveType: z.string().optional(),       // Antriebsart z.B. FWD, RWD, AWD, 4x4
  emissionClass: z.string().optional(),   // Schadstoffklasse z.B. Euro 6
  dealerPrice: MoneyAmountSchema.optional(),     // Händlerpreis EUR
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
  firstName: z.string().trim().max(120).optional().default(""),
  lastName: z.string().trim().max(120).optional().default(""),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  company: z.string().trim().optional(),
  taxId: z.string().optional(),
  idDocumentType: z.string().optional(),
  idDocumentNumber: z.string().optional(),
  idDocumentValidUntil: EmptyStringToUndefinedOptionalIsoDateSchema,
  notes: LimitedTextSchema(10_000).optional(),
  customerType: z.enum(["privat", "gewerblich"]).default("privat").optional(),
}).superRefine((value, ctx) => {
  if (value.customerType === "gewerblich") {
    if (!value.company?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["company"],
        message: "Firma ist erforderlich",
      });
    }
    return;
  }

  if (!value.firstName.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["firstName"],
      message: "Vorname ist erforderlich",
    });
  }
  if (!value.lastName.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lastName"],
      message: "Nachname ist erforderlich",
    });
  }
}).transform((value) => {
  if (value.customerType === "gewerblich") {
    return {
      ...value,
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim() || value.company?.trim() || "",
      company: value.company?.trim(),
    };
  }

  return value;
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
  idDocumentValidUntil: EmptyStringToUndefinedOptionalIsoDateSchema,
  notes: LimitedTextSchema(10_000).optional(),
  customerType: z.enum(["privat", "gewerblich"]).optional(),
});

export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;

// ─── Sale Schemas ────────────────────────────────────────────

export const SaleCreateSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle ID is required"),
  customerId: z.string().min(1, "Customer ID is required"),
  // Canonical contract: the amount paid by the customer (gross/final price).
  salePrice: MoneyAmountSchema,
  priceMode: z.literal("gross").default("gross"),
  taxRate: z.number().min(0).max(100).default(19.0),
  saleDate: OptionalIsoDateSchema.optional(),
  notes: LimitedTextSchema(10_000).optional(),
});
export const SaleStatusSchema = z.enum(["completed", "reversed"]);
export const SaleAccountingStatusSchema = z.enum([
  "verified",
  "legacy_snapshot",
  "legacy_ambiguous",
]);

export type SaleCreate = z.infer<typeof SaleCreateSchema>;

export const SaleAccountingSnapshotResolveSchema = z.object({
  historicTaxMode: z.enum(["regular", "margin"]),
  historicPriceMode: z.enum(["gross", "net"]).optional(),
  purchasePrice: MoneyAmountSchema.optional(),
  manualCosts: MoneyAmountSchema.optional(),
  exportCosts: MoneyAmountSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.historicTaxMode === "regular" && !value.historicPriceMode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["historicPriceMode"],
      message: "Brutto- oder Nettobasis ist bei Regelbesteuerung erforderlich",
    });
  }
});

export const SaleAccountingSnapshotSchema = z.object({
  accountingStatus: SaleAccountingStatusSchema,
  priceMode: z.enum(["gross", "net"]),
  marginTaxed: z.boolean(),
  grossCents: z.number().int(),
  netCents: z.number().int(),
  taxCents: z.number().int(),
  marginTaxCents: z.number().int(),
  purchasePriceCents: z.number().int(),
  manualCostsCents: z.number().int(),
  exportCostsCents: z.number().int(),
  totalCostCents: z.number().int(),
  grossAmount: z.number(),
  netAmount: z.number(),
  taxAmount: z.number(),
  marginTaxAmount: z.number(),
  purchasePrice: z.number(),
  manualCosts: z.number(),
  exportCosts: z.number(),
  totalCost: z.number(),
});

export type SaleAccountingSnapshotResolve = z.infer<
  typeof SaleAccountingSnapshotResolveSchema
>;

export const InvoiceCreateSchema = z.object({
  saleId: z.string().min(1),
  deliveryDate: OptionalIsoDateSchema,
  dueDate: OptionalIsoDateSchema.optional(),
  notes: LimitedTextSchema(10_000).optional(),
});
export const InvoiceCancelSchema = z.object({
  reason: LimitedTextSchema(1_000).refine(
    (value) => value.length >= 3,
    "Stornogrund muss mindestens 3 Zeichen haben"
  ),
});

export const InvoiceStatusSchema = z.enum(["issued", "canceled"]);
export const BusinessDocumentTypeSchema = z.literal("INVOICE");

export const InvoiceSchema = z.object({
  id: z.string(),
  dealerId: z.string(),
  saleId: z.string(),
  documentType: BusinessDocumentTypeSchema,
  invoiceNumber: z.string(),
  status: InvoiceStatusSchema,
  issuedAt: z.string(),
  dueAt: z.string().nullable(),
  grossCents: z.number().int(),
  netCents: z.number().int(),
  taxCents: z.number().int(),
  marginTaxCents: z.number().int(),
  grossAmount: z.number(),
  netAmount: z.number(),
  taxAmount: z.number(),
  marginTaxAmount: z.number(),
  taxRate: z.number(),
  marginTaxed: z.boolean(),
  artifactSha256: z.string(),
  templateVersion: z.string(),
  canceledAt: z.string().nullable(),
  canceledById: z.string().nullable(),
  cancelReason: z.string().nullable(),
  cancellationArtifactSha256: z.string().nullable(),
  notes: z.string().nullable(),
  snapshot: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type InvoiceCreate = z.infer<typeof InvoiceCreateSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;

// ─── Vehicle Cost Schemas ─────────────────────────────────────

export const VehicleCostCreateSchema = z.object({
  costType: z.string().min(1, "Cost type is required"),
  amount: MoneyAmountSchema.refine((value) => value > 0, "Amount must be positive"),
  notes: z.string().optional(),
});

export type VehicleCostCreate = z.infer<typeof VehicleCostCreateSchema>;

// ─── Document Generation Schemas ─────────────────────────────

export const DocumentTypeSchema = z.enum(["offer", "price-tag", "contract", "purchase-contract"]);

export const DocumentGenerateSchema = z.object({
  type: DocumentTypeSchema,
  vehicleId: z.string().min(1, "Vehicle ID is required"),
  customerId: z.string().optional(),
  contractPlace: z.string().trim().optional(),
  contractDate: z.string().trim().optional(),
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
  description: z.string().default(""),
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

export const FinancesDateRangeSchema = z.object({
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
});

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
  accountingStatus: z.enum(["verified", "legacy_snapshot", "legacy_ambiguous"]),
  purchasePrice: z.number().nullable(),
  manualAdditionalCosts: z.number().nullable(),
  exportAdditionalCosts: z.number().nullable(),
  additionalCosts: z.number().nullable(),
  costBreakdown: z.array(FinancesCostBreakdownItemSchema),
  salePrice: z.number().nullable(),
  grossSalePrice: z.number().nullable(),
  netSalePrice: z.number().nullable(),
  saleTaxAmount: z.number().nullable(),
  disclosedTaxAmount: z.number().nullable(),
  marginTaxAmount: z.number().nullable(),
  profit: z.number().nullable(),
  customerName: z.string(),
});

export const FinancesDataSchema = z.object({
  vehiclesBought: z.number(),
  totalPurchaseCost: z.number(),
  totalManualCosts: z.number(),
  totalExportCosts: z.number(),
  totalAdditionalCosts: z.number(),
  vehiclesSold: z.number(),
  accountedSales: z.number(),
  ambiguousSales: z.number(),
  legacySnapshotSales: z.number(),
  hasAccountingWarnings: z.boolean(),
  totalRevenue: z.number(),
  totalGrossRevenue: z.number(),
  totalNetRevenue: z.number(),
  totalSalesTax: z.number(),
  totalDisclosedSalesTax: z.number(),
  totalMarginTax: z.number(),
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
