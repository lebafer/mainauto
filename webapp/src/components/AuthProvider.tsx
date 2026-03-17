import { useState, useEffect, useCallback } from "react";
import { AuthContext, fetchSession, type SessionData } from "@/lib/auth-client";

const BRANDING_KEY = "ma_last_branding";

function applyBranding(session: SessionData | null) {
  const root = document.documentElement;
  const primary = session?.dealerSettings?.primaryColor ?? "#f59e0b";
  const accent = session?.dealerSettings?.accentColor ?? "#111827";

  root.style.setProperty("--tenant-primary", primary);
  root.style.setProperty("--tenant-accent", accent);

  if (session?.dealer || session?.dealerSettings) {
    localStorage.setItem(
      BRANDING_KEY,
      JSON.stringify({
        dealer: session.dealer,
        dealerSettings: session.dealerSettings,
      })
    );
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isPending, setIsPending] = useState(true);

  const refetch = useCallback(async () => {
    setIsPending(true);
    const data = await fetchSession();
    setSession(data);
    setIsPending(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    applyBranding(session);
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, isPending, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}
