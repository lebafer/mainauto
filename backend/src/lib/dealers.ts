import type {
  Dealer,
  DealerDomain,
  DealerDomainStatus,
  DealerMembership,
  DealerMembershipRole,
  DealerSettings,
  DealerSetupStatus,
  DealerSubscription,
  Plan,
  PlatformRole,
} from "@prisma/client";
import { prisma } from "../prisma";
import { env } from "../env";

export type FeatureEntitlements = Record<string, boolean>;
export type TenantStatus =
  | "unknown"
  | "pending_setup"
  | "ready_for_dns"
  | "active"
  | "suspended"
  | "inactive";

export const DEFAULT_PLATFORM_NAME = "Autohaus Hub";
export const DEFAULT_DEALER_NAME = "Referenz Autohaus";
export const DEFAULT_DEALER_SLUG = "mainauto";
export const DEFAULT_SUPPORT_EMAIL = "support@autohaus-hub.local";

export const DEFAULT_DEALER_SETTINGS = {
  displayName: "Referenz Autohaus",
  legalName: "Referenz Autohaus",
  addressLine1: "Musterstrasse 1",
  zip: "10115",
  city: "Berlin",
  country: "Deutschland",
  phone: "+49 30 000000",
  email: "info@referenz-autohaus.de",
  supportEmail: DEFAULT_SUPPORT_EMAIL,
  website: "https://www.referenz-autohaus.de",
  taxId: "DE000000000",
  legalRepresentative: "Max Mustermann",
  bankName: "Musterbank",
  iban: "DE00 0000 0000 0000 0000 00",
  bic: "TESTDE00XXX",
  primaryColor: "#f59e0b",
  accentColor: "#111827",
  loginHeadline: "Ihre White-Label-Autohaussoftware fuer Verkauf, Bestand und Prozesse.",
  documentFooterText:
    "Referenz Autohaus • Musterstrasse 1 • 10115 Berlin",
  documentLegalText: "USt-IdNr. DE000000000 • Vertretungsberechtigt: Max Mustermann",
  purchaseTerms: "Fahrzeugkauf zu den individuell vereinbarten Konditionen.",
  saleTerms: "Verkauf gemaess den im Vertrag aufgefuehrten Bedingungen.",
  logoUrl: null,
  faviconUrl: null,
} as const;

export const DEFAULT_PLAN_DEFINITIONS = [
  {
    slug: "basic",
    name: "Basic",
    description: "Grundpaket fuer die taegliche Fahrzeugverwaltung.",
    monthlyPriceCents: 9900,
    featureEntitlements: {
      branding: false,
      white_label: false,
      custom_domain: false,
      team_management: false,
      documents_advanced: false,
      ai_brief_extraction: false,
    },
  },
  {
    slug: "pro",
    name: "Pro",
    description: "Mit Branding, Teamverwaltung und erweiterten Dokumenten.",
    monthlyPriceCents: 19900,
    featureEntitlements: {
      branding: true,
      white_label: true,
      custom_domain: true,
      team_management: true,
      documents_advanced: true,
      ai_brief_extraction: false,
    },
  },
  {
    slug: "pro-ai",
    name: "Pro + KI",
    description: "Pro-Paket mit KI-Briefextraktion.",
    monthlyPriceCents: 24900,
    featureEntitlements: {
      branding: true,
      white_label: true,
      custom_domain: true,
      team_management: true,
      documents_advanced: true,
      ai_brief_extraction: true,
    },
  },
] as const;

export function slugifyDealerName(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "dealer";
}

export function parseFeatureEntitlements(value: unknown): FeatureEntitlements {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, enabled]) => [key, enabled === true])
  );
}

export function mergeFeatureEntitlements(
  planEntitlements: unknown,
  overrides: unknown
): FeatureEntitlements {
  return {
    ...parseFeatureEntitlements(planEntitlements),
    ...parseFeatureEntitlements(overrides),
  };
}

export function normalizeHost(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.trim().toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");
}

export function createFallbackDealerHost(slug: string): string {
  return `${slug}.${env.PLATFORM_DOMAIN}`;
}

export function getTenantStatus(input: {
  dealerStatus?: string | null;
  setupStatus?: DealerSetupStatus | string | null;
}): TenantStatus {
  if (!input.dealerStatus && !input.setupStatus) {
    return "unknown";
  }

  if (input.dealerStatus === "suspended" || input.setupStatus === "suspended") {
    return "suspended";
  }

  if (input.dealerStatus === "inactive") {
    return "inactive";
  }

  if (input.setupStatus === "ready_for_dns") {
    return "ready_for_dns";
  }

  if (input.setupStatus === "pending_setup") {
    return "pending_setup";
  }

  return "active";
}

export async function ensureDefaultPlans() {
  for (const plan of DEFAULT_PLAN_DEFINITIONS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        description: plan.description,
        monthlyPriceCents: plan.monthlyPriceCents,
        featureEntitlements: plan.featureEntitlements,
        isActive: true,
      },
      create: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        monthlyPriceCents: plan.monthlyPriceCents,
        featureEntitlements: plan.featureEntitlements,
        isActive: true,
      },
    });
  }
}

export async function ensureDefaultDealer() {
  const dealer = await prisma.dealer.upsert({
    where: { slug: DEFAULT_DEALER_SLUG },
    update: {
      name: DEFAULT_DEALER_NAME,
      setupStatus: "active",
      isDefault: true,
      status: "active",
    },
    create: {
      name: DEFAULT_DEALER_NAME,
      slug: DEFAULT_DEALER_SLUG,
      setupStatus: "active",
      isDefault: true,
      status: "active",
    },
  });

  await prisma.dealerSettings.upsert({
    where: { dealerId: dealer.id },
    update: {
      ...DEFAULT_DEALER_SETTINGS,
    },
    create: {
      dealerId: dealer.id,
      ...DEFAULT_DEALER_SETTINGS,
    },
  });

  await prisma.dealerDomain.upsert({
    where: {
      host: createFallbackDealerHost(dealer.slug),
    },
    update: {
      dealerId: dealer.id,
      status: "active",
      isPrimary: true,
      verificationToken: null,
      verifiedAt: new Date(),
    },
    create: {
      dealerId: dealer.id,
      host: createFallbackDealerHost(dealer.slug),
      status: "active",
      isPrimary: true,
      verificationToken: null,
      verifiedAt: new Date(),
    },
  });

  const proAiPlan = await prisma.plan.findUnique({ where: { slug: "pro-ai" } });
  if (proAiPlan) {
    await prisma.dealerSubscription.upsert({
      where: {
        dealerId_planId: {
          dealerId: dealer.id,
          planId: proAiPlan.id,
        },
      },
      update: {
        status: "active",
      },
      create: {
        dealerId: dealer.id,
        planId: proAiPlan.id,
        status: "active",
      },
    });
  }

  return dealer;
}

export async function ensureCoreSaasData() {
  await ensureDefaultPlans();
  return ensureDefaultDealer();
}

export type ActiveDealerMembership = DealerMembership & {
  dealer: Dealer & {
    settings: DealerSettings | null;
    domains: DealerDomain[];
    subscriptions: Array<DealerSubscription & { plan: Plan }>;
  };
};

export function pickActiveMembership(
  memberships: ActiveDealerMembership[]
): ActiveDealerMembership | null {
  if (memberships.length === 0) {
    return null;
  }

  return memberships[0] ?? null;
}

export function getMembershipEntitlements(membership: ActiveDealerMembership | null): FeatureEntitlements {
  const subscription = membership?.dealer.subscriptions.find(
    (item) => item.status === "active" || item.status === "trialing"
  );

  return mergeFeatureEntitlements(subscription?.plan.featureEntitlements, subscription?.featureOverrides);
}

export function getActiveDealerDomain(
  domains: Array<DealerDomain & { status?: DealerDomainStatus | string }> | undefined
): DealerDomain | null {
  if (!domains?.length) {
    return null;
  }

  return domains.find((domain) => domain.isPrimary && domain.status === "active") ?? domains[0] ?? null;
}

export function isPlatformSuperAdmin(platformRole: PlatformRole | string | null | undefined): boolean {
  return platformRole === "platform_super_admin";
}

export function hasDealerRole(
  membershipRole: DealerMembershipRole | string | null | undefined,
  allowedRoles: string[]
): boolean {
  return membershipRole ? allowedRoles.includes(membershipRole) : false;
}
