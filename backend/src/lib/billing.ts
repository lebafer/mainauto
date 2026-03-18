import type { DealerSubscription, Plan } from "@prisma/client";

export const TRIAL_DAYS = 14;

export type DealerSubscriptionWithPlan = DealerSubscription & { plan: Plan };

export type BillingState = {
  status: DealerSubscription["status"] | "none";
  trialEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
  isComplimentary: boolean;
  requiresPayment: boolean;
  canAccessApp: boolean;
};

export function addTrialDays(date: Date, days: number = TRIAL_DAYS): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getCurrentSubscription(
  subscriptions: DealerSubscriptionWithPlan[] | undefined
): DealerSubscriptionWithPlan | null {
  if (!subscriptions?.length) {
    return null;
  }

  const ordered = [...subscriptions].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  );

  return (
    ordered.find((item) => item.status === "active") ??
    ordered.find((item) => item.status === "trialing") ??
    ordered.find((item) => item.status === "past_due") ??
    ordered[0] ??
    null
  );
}

export function getBillingState(
  subscription: Pick<
    DealerSubscription,
    "status" | "trialEndsAt" | "currentPeriodEndsAt" | "endsAt" | "complimentaryAccess"
  > | null | undefined,
  now: Date = new Date()
): BillingState {
  if (!subscription) {
    return {
      status: "none",
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      isComplimentary: false,
      requiresPayment: true,
      canAccessApp: false,
    };
  }

  const trialEndsAt = subscription.trialEndsAt ?? null;
  const currentPeriodEndsAt = subscription.currentPeriodEndsAt ?? subscription.endsAt ?? null;
  const isComplimentary = subscription.complimentaryAccess === true;
  const isTrialing = subscription.status === "trialing";
  const isTrialActive = Boolean(trialEndsAt && trialEndsAt.getTime() > now.getTime());
  const hasCurrentPeriodAccess = Boolean(
    currentPeriodEndsAt && currentPeriodEndsAt.getTime() > now.getTime()
  );

  if (isComplimentary) {
    return {
      status: subscription.status,
      trialEndsAt,
      currentPeriodEndsAt,
      isComplimentary,
      requiresPayment: false,
      canAccessApp: true,
    };
  }

  if (subscription.status === "active") {
    return {
      status: subscription.status,
      trialEndsAt,
      currentPeriodEndsAt,
      isComplimentary: false,
      requiresPayment: false,
      canAccessApp: true,
    };
  }

  if (isTrialing) {
    return {
      status: subscription.status,
      trialEndsAt,
      currentPeriodEndsAt,
      isComplimentary: false,
      requiresPayment: !isTrialActive,
      canAccessApp: isTrialActive,
    };
  }

  if (subscription.status === "canceled") {
    return {
      status: subscription.status,
      trialEndsAt,
      currentPeriodEndsAt,
      isComplimentary: false,
      requiresPayment: !hasCurrentPeriodAccess,
      canAccessApp: hasCurrentPeriodAccess,
    };
  }

  return {
    status: subscription.status,
    trialEndsAt,
    currentPeriodEndsAt,
    isComplimentary: false,
    requiresPayment: true,
    canAccessApp: false,
  };
}
