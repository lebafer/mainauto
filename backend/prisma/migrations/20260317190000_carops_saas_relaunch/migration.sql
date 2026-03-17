ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "stripePriceMonthlyId" TEXT;

ALTER TABLE "DealerSubscription"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT,
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "currentPeriodEndsAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "DealerSubscription_stripeSubscriptionId_key"
  ON "DealerSubscription"("stripeSubscriptionId");
