import { useState, useEffect, useCallback } from "react";
import { AuthContext, fetchSession, type PublicTenantContext, type SessionData } from "@/lib/auth-client";
import { fetchTenantContext } from "@/lib/tenant-client";

const BRANDING_KEY = "ma_last_branding";

function normalizeHexColor(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return fallback;
  }

  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }

  return trimmed.toLowerCase();
}

function hexToRgbString(hex: string) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r} ${g} ${b}`;
}

function hexToHslString(hex: string) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function getForegroundHsl(hex: string) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.62 ? "222 14% 8%" : "0 0% 100%";
}

function setDocumentMetadata(branding: {
  title: string;
  faviconUrl?: string | null;
}) {
  document.title = branding.title;

  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (branding.faviconUrl) {
    if (existing) {
      existing.href = branding.faviconUrl;
    } else {
      const icon = document.createElement("link");
      icon.rel = "icon";
      icon.href = branding.faviconUrl;
      document.head.appendChild(icon);
    }
  }
}

function applyBranding(session: SessionData | null, tenant: PublicTenantContext | null) {
  const root = document.documentElement;
  const source = session?.dealerSettings ?? tenant;
  const primary = normalizeHexColor(source?.primaryColor, "#f59e0b");
  const accent = normalizeHexColor(source?.accentColor, "#111827");
  const primaryHsl = hexToHslString(primary);
  const accentHsl = hexToHslString(accent);
  const primaryFg = getForegroundHsl(primary);
  const accentFg = getForegroundHsl(accent);

  root.style.setProperty("--tenant-primary", primary);
  root.style.setProperty("--tenant-accent", accent);
  root.style.setProperty("--tenant-primary-rgb", hexToRgbString(primary));
  root.style.setProperty("--tenant-accent-rgb", hexToRgbString(accent));

  root.style.setProperty("--primary", primaryHsl);
  root.style.setProperty("--primary-foreground", primaryFg);
  root.style.setProperty("--ring", primaryHsl);
  root.style.setProperty("--sidebar-primary", primaryHsl);
  root.style.setProperty("--sidebar-primary-foreground", primaryFg);
  root.style.setProperty("--sidebar-ring", primaryHsl);
  root.style.setProperty("--sidebar-accent", primaryHsl);
  root.style.setProperty("--sidebar-accent-foreground", primaryFg);
  root.style.setProperty("--accent", accentHsl);
  root.style.setProperty("--accent-foreground", accentFg);
  root.style.setProperty("--secondary", accentHsl);
  root.style.setProperty("--secondary-foreground", accentFg);

  setDocumentMetadata({
    title:
      source?.displayName ||
      session?.dealer?.name ||
      tenant?.displayName ||
      "Autohaus Hub",
    faviconUrl: source?.faviconUrl,
  });

  if (session?.dealer || session?.dealerSettings || tenant?.dealer) {
    localStorage.setItem(
      BRANDING_KEY,
      JSON.stringify({
        dealer: session.dealer,
        dealerSettings: session.dealerSettings,
        tenant,
      })
    );
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
    applyBranding(session, tenant);
  }, [session, tenant]);

  return (
    <AuthContext.Provider value={{ session, tenant, isPending, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}
