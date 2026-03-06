import { useState, useEffect, useCallback } from "react";
import { AuthContext, fetchSession, type SessionData } from "@/lib/auth-client";

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

  return (
    <AuthContext.Provider value={{ session, isPending, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}
