import type {
  Dealer,
  DealerMembership,
  DealerMembershipRole,
  DealerSettings,
  DealerSubscription,
  Plan,
  PlatformRole,
} from "@prisma/client";
import { prisma } from "../prisma";

export type FeatureEntitlements = Record<string, boolean>;

export const DEFAULT_PLATFORM_NAME = "MeinAuto OS";
export const DEFAULT_DEALER_NAME = "MainAuto Miltenberg Manuel Rui Fernandes";
export const DEFAULT_DEALER_SLUG = "mainauto";

export const DEFAULT_DEALER_SETTINGS = {
  legalName: "MainAuto Miltenberg Manuel Rui Fernandes",
  addressLine1: "Mainzer Str. 10 + 37",
  zip: "63897",
  city: "Miltenberg",
  country: "Deutschland",
  phone: "+49(0)9371-5054245",
  email: "mainauto@gmail.com",
  website: "www.mainauto.eu",
  taxId: "DE196691148",
  legalRepresentative: "Manuel Rui Fernandes",
  bankName: "Sparkasse Odenwaldkreis",
  iban: "DE 59 5085 1952 0000 1147 77",
  bic: "HELADEF1ERB",
  primaryColor: "#f59e0b",
  accentColor: "#111827",
  documentFooterText:
    "MainAuto Miltenberg Manuel Rui Fernandes • Mainzer Str. 10 + 37 • 63897 Miltenberg",
  documentLegalText: "USt-IdNr. DE196691148 • Vertretungsberechtigt: Manuel Rui Fernandes",
  purchaseTerms: "Fahrzeugkauf zu den individuell vereinbarten Konditionen.",
  saleTerms: "Verkauf gemaess den im Vertrag aufgefuehrten Bedingungen.",
} as const;

export const DEFAULT_PLAN_DEFINITIONS = [
  {
    slug: "basic",
    name: "Basic",
    description: "Grundpaket fuer die taegliche Fahrzeugverwaltung.",
    monthlyPriceCents: 9900,
    featureEntitlements: {
      branding: false,
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
      isDefault: true,
      status: "active",
    },
    create: {
      name: DEFAULT_DEALER_NAME,
      slug: DEFAULT_DEALER_SLUG,
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

export function isPlatformSuperAdmin(platformRole: PlatformRole | string | null | undefined): boolean {
  return platformRole === "platform_super_admin";
}

export function hasDealerRole(
  membershipRole: DealerMembershipRole | string | null | undefined,
  allowedRoles: string[]
): boolean {
  return membershipRole ? allowedRoles.includes(membershipRole) : false;
}
