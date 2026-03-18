import { useState, useEffect, useCallback } from "react";
import { AuthContext, fetchSession, type PublicTenantContext, type SessionData } from "@/lib/auth-client";
import { fetchTenantContext } from "@/lib/tenant-client";

function applyPlatformBranding() {
  document.title = "CarOps";
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
    applyPlatformBranding();
  }, [session, tenant]);

  return (
    <AuthContext.Provider value={{ session, tenant, isPending, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}
