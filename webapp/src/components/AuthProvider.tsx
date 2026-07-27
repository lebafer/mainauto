import { useState, useEffect, useCallback } from "react";
import { AuthContext, fetchSession, type PublicTenantContext, type SessionData } from "@/lib/auth-client";
import { fetchTenantContext } from "@/lib/tenant-client";

function hexToRgbChannels(value?: string | null): string | null {
  const match = value?.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return null;
  return `${parseInt(match[1], 16)} ${parseInt(match[2], 16)} ${parseInt(match[3], 16)}`;
}

function applyPlatformBranding(
  tenant: PublicTenantContext | null,
  session: SessionData | null
) {
  const displayName =
    session?.dealerSettings?.displayName ??
    tenant?.displayName ??
    session?.dealer?.name ??
    "CarOps";
  document.title = displayName === "CarOps" ? "CarOps" : `${displayName} · CarOps`;

  const primaryColor = session?.dealerSettings?.primaryColor ?? tenant?.primaryColor;
  const accentColor = session?.dealerSettings?.accentColor ?? tenant?.accentColor;
  const primaryRgb = hexToRgbChannels(primaryColor);
  const accentRgb = hexToRgbChannels(accentColor);
  if (primaryColor && primaryRgb) {
    document.documentElement.style.setProperty("--tenant-primary", primaryColor);
    document.documentElement.style.setProperty("--tenant-primary-rgb", primaryRgb);
  }
  if (accentColor && accentRgb) {
    document.documentElement.style.setProperty("--tenant-accent", accentColor);
    document.documentElement.style.setProperty("--tenant-accent-rgb", accentRgb);
  }

  const faviconUrl = session?.dealerSettings?.faviconUrl ?? tenant?.faviconUrl;
  if (faviconUrl) {
    const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
    const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (favicon) favicon.href = faviconUrl.startsWith("http") ? faviconUrl : `${baseUrl}${faviconUrl}`;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [tenant, setTenant] = useState<PublicTenantContext | null>(null);
  const [isPending, setIsPending] = useState(true);

  const refetch = useCallback(async () => {
    setIsPending(true);
    const [tenantData, sessionData] = await Promise.all([fetchTenantContext(), fetchSession()]);
    setTenant(tenantData);
    setSession(sessionData);
    setIsPending(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    applyPlatformBranding(tenant, session);
  }, [session, tenant]);

  return (
    <AuthContext.Provider value={{ session, tenant, isPending, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}
