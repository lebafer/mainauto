import { Hono } from "hono";
import { getCurrentEntitlements, getCurrentMembership, getCurrentUser } from "../lib/request-context";

const sessionRouter = new Hono();

sessionRouter.get("/me", async (c) => {
  const user = getCurrentUser(c);
  const membership = getCurrentMembership(c);
  const entitlements = getCurrentEntitlements(c);
  const subscription =
    membership?.dealer.subscriptions.find((item) => item.status === "active" || item.status === "trialing") ?? null;

  return c.json({
    data: {
      user: {
        id: user.id,
        name: user.name ?? "",
        email: user.email ?? "",
        username: user.username ?? null,
        image: null,
        platformRole: user.platformRole ?? "user",
      },
      dealer: membership
        ? {
            id: membership.dealer.id,
            name: membership.dealer.name,
            slug: membership.dealer.slug,
            status: membership.dealer.status,
            isDefault: membership.dealer.isDefault,
            createdAt: membership.dealer.createdAt.toISOString(),
            updatedAt: membership.dealer.updatedAt.toISOString(),
          }
        : null,
      dealerRole: membership?.role ?? null,
      dealerSettings: membership?.dealer.settings
        ? {
            dealerId: membership.dealer.settings.dealerId,
            legalName: membership.dealer.settings.legalName,
            addressLine1: membership.dealer.settings.addressLine1,
            zip: membership.dealer.settings.zip,
            city: membership.dealer.settings.city,
            country: membership.dealer.settings.country,
            phone: membership.dealer.settings.phone,
            email: membership.dealer.settings.email,
            website: membership.dealer.settings.website,
            taxId: membership.dealer.settings.taxId,
            legalRepresentative: membership.dealer.settings.legalRepresentative,
            bankName: membership.dealer.settings.bankName,
            iban: membership.dealer.settings.iban,
            bic: membership.dealer.settings.bic,
            logoUrl: membership.dealer.settings.logoUrl,
            primaryColor: membership.dealer.settings.primaryColor,
            accentColor: membership.dealer.settings.accentColor,
            documentFooterText: membership.dealer.settings.documentFooterText,
            documentLegalText: membership.dealer.settings.documentLegalText,
            purchaseTerms: membership.dealer.settings.purchaseTerms,
            saleTerms: membership.dealer.settings.saleTerms,
            createdAt: membership.dealer.settings.createdAt.toISOString(),
            updatedAt: membership.dealer.settings.updatedAt.toISOString(),
          }
        : null,
      entitlements,
      subscription: subscription
        ? {
            id: subscription.id,
            dealerId: subscription.dealerId,
            planId: subscription.planId,
            status: subscription.status,
            featureOverrides: subscription.featureOverrides ?? {},
            billingNotes: subscription.billingNotes,
            startsAt: subscription.startsAt.toISOString(),
            endsAt: subscription.endsAt?.toISOString() ?? null,
            createdAt: subscription.createdAt.toISOString(),
            updatedAt: subscription.updatedAt.toISOString(),
            plan: {
              id: subscription.plan.id,
              slug: subscription.plan.slug,
              name: subscription.plan.name,
              description: subscription.plan.description,
              monthlyPriceCents: subscription.plan.monthlyPriceCents,
              featureEntitlements: subscription.plan.featureEntitlements,
              isActive: subscription.plan.isActive,
              createdAt: subscription.plan.createdAt.toISOString(),
              updatedAt: subscription.plan.updatedAt.toISOString(),
            },
          }
        : null,
    },
  });
});

export { sessionRouter };
