import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Lock, Loader2, User } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient, TOKEN_KEY, useAuth } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { CarOpsLogo } from "@/components/branding/CarOpsLogo";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const { session } = useAuth();
  const isTenantBlocked = session?.tenantStatus === "suspended" || session?.tenantStatus === "inactive";

  const signInMutation = useMutation({
    mutationFn: async () => {
      const result = await authClient.signIn.username({
        username: username.trim(),
        password: password.trim(),
      });

      if (result.error) {
        const authErrorMessage =
          typeof result.error === "object" &&
          result.error !== null &&
          "message" in result.error &&
          typeof result.error.message === "string"
            ? result.error.message
            : "";
        throw new Error(authErrorMessage || "Benutzername oder Passwort ist falsch.");
      }

      const token = (result.data as { token?: string } | null)?.token;
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      }
    },
    onSuccess: () => {
      window.location.replace("/dashboard");
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    signInMutation.mutate();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#fff8ef_0%,#fff_35%,#fff_100%)] p-4 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_50%,#020617_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),transparent_30%)]" />

      <Card className="relative z-10 w-full max-w-md border-border/60 bg-card/90 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-6 text-center">
          <div className="flex justify-center">
            <CarOpsLogo />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Willkommen zurueck</CardTitle>
            <CardDescription className="text-base">
              Melde dich an und steuere dein Autohaus in CarOps.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Benutzername
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Benutzername"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="username"
                  autoFocus
                  disabled={isTenantBlocked}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Passwort
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Passwort"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="current-password"
                  disabled={isTenantBlocked}
                />
              </div>
            </div>

            {isTenantBlocked ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Dieser Zugang ist derzeit nicht verfuegbar. Bitte wende dich an den Support.
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isTenantBlocked || signInMutation.isPending || !username.trim() || !password.trim()}
            >
              {signInMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird angemeldet...
                </>
              ) : (
                "Anmelden"
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Noch kein Account?{" "}
              <Link to="/signup" className="font-medium text-amber-600 hover:text-amber-500">
                Jetzt kostenlos starten
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
