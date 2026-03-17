import { Hono } from "hono";
import {
  getBillingState,
  getCurrentEntitlements,
  getCurrentMembership,
  getCurrentUser,
  getResolvedDomain,
  getResolvedHost,
  getTenantStatus,
} from "../lib/request-context";
import { getActiveDealerDomain } from "../lib/dealers";
import { getCurrentSubscription } from "../lib/billing";

const sessionRouter = new Hono();

sessionRouter.get("/me", async (c) => {
  const user = getCurrentUser(c);
  const membership = getCurrentMembership(c);
  const entitlements = getCurrentEntitlements(c);
  const resolvedDomain = getResolvedDomain(c);
  const resolvedHost = getResolvedHost(c);
  const tenantStatus = getTenantStatus(c);
  const billing = getBillingState(c);
  const subscription = getCurrentSubscription(membership?.dealer.subscriptions);
  const activeDomain = resolvedDomain ?? getActiveDealerDomain(membership?.dealer.domains);

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
            setupStatus: membership.dealer.setupStatus,
            isDefault: membership.dealer.isDefault,
            createdAt: membership.dealer.createdAt.toISOString(),
            updatedAt: membership.dealer.updatedAt.toISOString(),
          }
        : null,
      dealerRole: membership?.role ?? null,
      dealerSettings: membership?.dealer.settings
        ? {
            dealerId: membership.dealer.settings.dealerId,
            displayName: membership.dealer.settings.displayName,
            legalName: membership.dealer.settings.legalName,
            addressLine1: membership.dealer.settings.addressLine1,
            zip: membership.dealer.settings.zip,
            city: membership.dealer.settings.city,
            country: membership.dealer.settings.country,
            phone: membership.dealer.settings.phone,
            email: membership.dealer.settings.email,
            supportEmail: membership.dealer.settings.supportEmail,
            website: membership.dealer.settings.website,
            taxId: membership.dealer.settings.taxId,
            legalRepresentative: membership.dealer.settings.legalRepresentative,
            bankName: membership.dealer.settings.bankName,
            iban: membership.dealer.settings.iban,
            bic: membership.dealer.settings.bic,
            logoUrl: membership.dealer.settings.logoUrl,
            faviconUrl: membership.dealer.settings.faviconUrl,
            primaryColor: membership.dealer.settings.primaryColor,
            accentColor: membership.dealer.settings.accentColor,
            loginHeadline: membership.dealer.settings.loginHeadline,
            documentFooterText: membership.dealer.settings.documentFooterText,
            documentLegalText: membership.dealer.settings.documentLegalText,
            purchaseTerms: membership.dealer.settings.purchaseTerms,
            saleTerms: membership.dealer.settings.saleTerms,
            createdAt: membership.dealer.settings.createdAt.toISOString(),
            updatedAt: membership.dealer.settings.updatedAt.toISOString(),
          }
        : null,
      activeDomain: activeDomain
        ? {
            id: activeDomain.id,
            dealerId: activeDomain.dealerId,
            host: activeDomain.host,
            status: activeDomain.status,
            isPrimary: activeDomain.isPrimary,
            verificationToken: activeDomain.verificationToken,
            verifiedAt: activeDomain.verifiedAt?.toISOString() ?? null,
            createdAt: activeDomain.createdAt.toISOString(),
            updatedAt: activeDomain.updatedAt.toISOString(),
          }
        : null,
      tenantStatus,
      resolvedHost,
      entitlements,
      billing: {
        status: billing.status,
        trialEndsAt: billing.trialEndsAt?.toISOString() ?? null,
        currentPeriodEndsAt: billing.currentPeriodEndsAt?.toISOString() ?? null,
        requiresPayment: billing.requiresPayment,
        canAccessApp: billing.canAccessApp,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            dealerId: subscription.dealerId,
            planId: subscription.planId,
            status: subscription.status,
            stripeCustomerId: subscription.stripeCustomerId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            stripeCheckoutSessionId: subscription.stripeCheckoutSessionId,
            stripePriceId: subscription.stripePriceId,
            featureOverrides: subscription.featureOverrides ?? {},
            billingNotes: subscription.billingNotes,
            trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
            currentPeriodEndsAt: subscription.currentPeriodEndsAt?.toISOString() ?? null,
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
              stripePriceMonthlyId: subscription.plan.stripePriceMonthlyId,
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
