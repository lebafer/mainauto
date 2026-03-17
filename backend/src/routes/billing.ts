import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type Stripe from "stripe";
import { prisma } from "../prisma";
import { getCurrentDealer, getCurrentMembership, getCurrentUser, requireDealerRole } from "../lib/request-context";
import { addTrialDays, getCurrentSubscription } from "../lib/billing";
import { getStripeClient, isStripeEnabled } from "../lib/stripe";
import {
  BillingCheckoutCreateSchema,
  BillingPortalCreateSchema,
  StripeCheckoutMetadataSchema,
} from "../types";

const billingRouter = new Hono();

function getAppOrigin(c: { req: { header: (name: string) => string | undefined } }) {
  const explicitOrigin = c.req.header("origin")?.trim();
  if (explicitOrigin) {
    return explicitOrigin.replace(/\/$/, "");
  }

  const referer = c.req.header("referer")?.trim();
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // ignore
    }
  }

  const host =
    c.req.header("x-forwarded-host")?.split(",")[0]?.trim() ||
    c.req.header("host")?.trim();
  const proto =
    c.req.header("x-forwarded-proto")?.split(",")[0]?.trim() ||
    "https";

  return host ? `${proto}://${host}` : "";
}

function buildReturnUrl(origin: string, returnPath: string | undefined, fallbackPath: string) {
  if (returnPath?.startsWith("/")) {
    return `${origin}${returnPath}`;
  }

  return `${origin}${fallbackPath}`;
}

function mapStripeStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "trialing":
      return "trialing" as const;
    case "active":
      return "active" as const;
    case "past_due":
    case "unpaid":
      return "past_due" as const;
    case "paused":
      return "suspended" as const;
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
      return "canceled" as const;
    default:
      return "canceled" as const;
  }
}

async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const metadata = StripeCheckoutMetadataSchema.safeParse(subscription.metadata);
  const plan =
    (priceId
      ? await prisma.plan.findFirst({
          where: {
            stripePriceMonthlyId: priceId,
          },
        })
      : null) ??
    (metadata.success
      ? await prisma.plan.findFirst({
          where: {
            slug: metadata.data.planSlug,
          },
        })
      : null);

  if (!plan) {
    return;
  }

  const existing =
    (metadata.success
      ? await prisma.dealerSubscription.findUnique({
          where: { id: metadata.data.dealerSubscriptionId },
        })
      : null) ??
    (typeof subscription.id === "string"
      ? await prisma.dealerSubscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        })
      : null) ??
    (typeof subscription.customer === "string"
      ? await prisma.dealerSubscription.findFirst({
          where: {
            stripeCustomerId: subscription.customer,
            planId: plan.id,
          },
          orderBy: { createdAt: "desc" },
        })
      : null);

  const dealerId = existing?.dealerId ?? (metadata.success ? metadata.data.dealerId : null);
  if (!dealerId) {
    return;
  }

  const localStatus = mapStripeStatus(subscription.status);
  const trialEndsAt = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end ?? null;
  const currentPeriodEndsAt = currentPeriodEnd
    ? new Date(currentPeriodEnd * 1000)
    : null;
  const stripeCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  const record = existing
    ? await prisma.dealerSubscription.update({
        where: { id: existing.id },
        data: {
          planId: plan.id,
          status: localStatus,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          trialEndsAt,
          currentPeriodEndsAt,
          endsAt: currentPeriodEndsAt,
        },
      })
    : await prisma.dealerSubscription.upsert({
        where: {
          dealerId_planId: {
            dealerId,
            planId: plan.id,
          },
        },
        update: {
          status: localStatus,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          trialEndsAt,
          currentPeriodEndsAt,
          endsAt: currentPeriodEndsAt,
        },
        create: {
          dealerId,
          planId: plan.id,
          status: localStatus,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          trialEndsAt,
          currentPeriodEndsAt,
          endsAt: currentPeriodEndsAt,
        },
      });

  if (record.status === "active" || record.status === "trialing") {
    await prisma.dealerSubscription.updateMany({
      where: {
        dealerId,
        id: { not: record.id },
        status: {
          in: ["active", "trialing", "past_due"],
        },
      },
      data: {
        status: "canceled",
      },
    });
  }
}

billingRouter.post(
  "/checkout",
  zValidator("json", BillingCheckoutCreateSchema),
  async (c) => {
    const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
    if (forbidden) {
      return forbidden;
    }

    if (!isStripeEnabled()) {
      return c.json(
        { error: { code: "STRIPE_NOT_CONFIGURED", message: "Stripe ist noch nicht konfiguriert." } },
        503
      );
    }

    const data = c.req.valid("json");
    const dealer = getCurrentDealer(c);
    const membership = getCurrentMembership(c);
    const user = getCurrentUser(c);
    const origin = getAppOrigin(c);
    const selectedPlan = await prisma.plan.findFirst({
      where: {
        slug: data.planSlug,
        isActive: true,
      },
    });

    if (!selectedPlan || !selectedPlan.stripePriceMonthlyId) {
      return c.json(
        { error: { code: "PLAN_NOT_AVAILABLE", message: "Dieser Tarif kann derzeit nicht gebucht werden." } },
        409
      );
    }

    const currentSubscription = getCurrentSubscription(membership?.dealer.subscriptions);
    const pendingSubscription = await prisma.dealerSubscription.upsert({
      where: {
        dealerId_planId: {
          dealerId: dealer.id,
          planId: selectedPlan.id,
        },
      },
      update: {
        status: currentSubscription?.status === "active" ? "active" : "trialing",
        trialEndsAt: currentSubscription?.trialEndsAt ?? addTrialDays(new Date()),
        stripePriceId: selectedPlan.stripePriceMonthlyId,
      },
      create: {
        dealerId: dealer.id,
        planId: selectedPlan.id,
        status: "trialing",
        trialEndsAt: currentSubscription?.trialEndsAt ?? addTrialDays(new Date()),
        stripePriceId: selectedPlan.stripePriceMonthlyId,
      },
    });

  const stripe = getStripeClient();
  const stripeCustomerId = pendingSubscription.stripeCustomerId ?? currentSubscription?.stripeCustomerId ?? null;
  const dealerSettings = (dealer.settings as { legalName?: string | null } | null | undefined) ?? null;
  const customerId =
    stripeCustomerId ??
      (
        await stripe.customers.create({
          name: dealerSettings?.legalName ?? dealer.name,
          email: user.email ?? undefined,
          metadata: {
            dealerId: dealer.id,
          },
        })
      ).id;

    const metadata = {
      dealerId: dealer.id,
      planSlug: selectedPlan.slug,
      dealerSubscriptionId: pendingSubscription.id,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: dealer.id,
      success_url: buildReturnUrl(origin, data.returnPath, "/billing?checkout=success"),
      cancel_url: buildReturnUrl(origin, data.returnPath, "/billing?checkout=cancelled"),
      line_items: [
        {
          price: selectedPlan.stripePriceMonthlyId,
          quantity: 1,
        },
      ],
      metadata,
      subscription_data: {
        metadata,
        ...(pendingSubscription.trialEndsAt && pendingSubscription.trialEndsAt.getTime() > Date.now()
          ? {
              trial_end: Math.floor(pendingSubscription.trialEndsAt.getTime() / 1000),
            }
          : {}),
      },
    });

    await prisma.dealerSubscription.update({
      where: { id: pendingSubscription.id },
      data: {
        stripeCustomerId: customerId,
        stripeCheckoutSessionId: session.id,
        stripePriceId: selectedPlan.stripePriceMonthlyId,
      },
    });

    return c.json({ data: { url: session.url } });
  }
);

billingRouter.post(
  "/portal",
  zValidator("json", BillingPortalCreateSchema),
  async (c) => {
    const forbidden = requireDealerRole(c, ["dealer_owner", "dealer_admin"]);
    if (forbidden) {
      return forbidden;
    }

    if (!isStripeEnabled()) {
      return c.json(
        { error: { code: "STRIPE_NOT_CONFIGURED", message: "Stripe ist noch nicht konfiguriert." } },
        503
      );
    }

    const data = c.req.valid("json");
    const dealer = getCurrentDealer(c);
    const membership = getCurrentMembership(c);
    const currentSubscription = getCurrentSubscription(membership?.dealer.subscriptions);
    const stripeCustomerId = currentSubscription?.stripeCustomerId;

    if (!stripeCustomerId) {
      return c.json(
        { error: { code: "BILLING_NOT_READY", message: "Es ist noch kein Stripe-Kunde vorhanden." } },
        409
      );
    }

    const stripe = getStripeClient();
    const origin = getAppOrigin(c);
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: buildReturnUrl(origin, data.returnPath, "/billing"),
    });

    return c.json({ data: { url: session.url } });
  }
);

billingRouter.post("/webhook", async (c) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: { code: "STRIPE_NOT_CONFIGURED", message: "Webhook ist nicht konfiguriert." } }, 503);
  }

  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Stripe-Signatur fehlt." } }, 400);
  }

  const rawBody = await c.req.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return c.json(
      {
        error: {
          code: "INVALID_SIGNATURE",
          message: error instanceof Error ? error.message : "Webhook-Signatur ungueltig.",
        },
      },
      400
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = StripeCheckoutMetadataSchema.safeParse(session.metadata);

      if (metadata.success) {
        await prisma.dealerSubscription.update({
          where: { id: metadata.data.dealerSubscriptionId },
          data: {
            stripeCustomerId:
              typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
            stripeSubscriptionId:
              typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
            stripeCheckoutSessionId: session.id,
          },
        });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncStripeSubscription(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }

  return c.json({ data: { received: true } });
});

export { billingRouter };
