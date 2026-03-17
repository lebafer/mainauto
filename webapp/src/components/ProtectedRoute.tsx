import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, isPending } = useAuth();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.tenantStatus === "suspended" || session.tenantStatus === "inactive") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Mandant nicht verfuegbar</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Dieser Zugang ist derzeit gesperrt oder inaktiv. Bitte kontaktiere den Support deines Autohauses.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
