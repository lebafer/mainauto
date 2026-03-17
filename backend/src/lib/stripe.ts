import Stripe from "stripe";
import { env } from "../env";

let stripeClient: Stripe | null = null;

export function isStripeEnabled() {
  return Boolean(env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY?.trim()) {
    throw new Error("Stripe ist nicht konfiguriert.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}
