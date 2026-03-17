import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { createContext, useContext } from "react";

export const TOKEN_KEY = "ba_token";
const AUTH_BASE_URL = import.meta.env.VITE_BACKEND_URL || "";

// Production defaults to relative URLs; in development VITE_BACKEND_URL can target backend directly.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BACKEND_URL || undefined,
  plugins: [usernameClient()],
  fetchOptions: {
    credentials: "include",
  },
});

// Session type
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  image: string | null;
  platformRole: "user" | "platform_super_admin";
}

export interface DealerInfo {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "inactive";
  setupStatus: "pending_setup" | "ready_for_dns" | "active" | "suspended";
  isDefault: boolean;
}

export interface DealerSettingsInfo {
  dealerId: string;
  displayName?: string | null;
  legalName?: string | null;
  addressLine1?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  supportEmail?: string | null;
  website?: string | null;
  taxId?: string | null;
  legalRepresentative?: string | null;
  bankName?: string | null;
  iban?: string | null;
  bic?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  loginHeadline?: string | null;
  documentFooterText?: string | null;
  documentLegalText?: string | null;
  purchaseTerms?: string | null;
  saleTerms?: string | null;
}

export interface DealerDomainInfo {
  id: string;
  dealerId: string;
  host: string;
  status: "pending_dns" | "active" | "failed" | "disabled";
  isPrimary: boolean;
  verificationToken?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealerSubscriptionInfo {
  id: string;
  dealerId: string;
  planId: string;
  status: "active" | "trialing" | "past_due" | "suspended" | "canceled";
  featureOverrides?: Record<string, boolean>;
  billingNotes?: string | null;
  startsAt: string;
  endsAt?: string | null;
  plan?: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    monthlyPriceCents: number;
    featureEntitlements: Record<string, boolean>;
    isActive: boolean;
  };
}

export interface SessionData {
  user: SessionUser;
  dealer: DealerInfo | null;
  dealerRole: "dealer_owner" | "dealer_admin" | "staff" | null;
  dealerSettings: DealerSettingsInfo | null;
  activeDomain?: DealerDomainInfo | null;
  tenantStatus: "unknown" | "pending_setup" | "ready_for_dns" | "active" | "suspended" | "inactive";
  resolvedHost?: string | null;
  entitlements: Record<string, boolean>;
  subscription?: DealerSubscriptionInfo | null;
}

export interface PublicTenantContext {
  displayName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  loginHeadline: string | null;
  supportEmail: string | null;
  tenantStatus: "unknown" | "pending_setup" | "ready_for_dns" | "active" | "suspended" | "inactive";
  dealer: DealerInfo | null;
  activeDomain: DealerDomainInfo | null;
}

// Direct session fetch that bypasses Better Auth's useSession hook
export async function fetchSession(): Promise<SessionData | null> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${AUTH_BASE_URL}/api/session/me`, {
      method: "GET",
      credentials: "include",
      headers,
    });

    if (!res.ok) return null;
    const payload = await res.json();
    const data = payload?.data ?? payload;
    if (!data || !data.user) return null;
    return data as SessionData;
  } catch {
    return null;
  }
}

// React context for session
export interface AuthContextType {
  session: SessionData | null;
  tenant: PublicTenantContext | null;
  isPending: boolean;
  refetch: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  tenant: null,
  isPending: true,
  refetch: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export async function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  try {
    await authClient.signOut();
  } catch {
    // ignore
  }
  window.location.replace("/login");
}
