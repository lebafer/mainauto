import { useState } from "react";
import { User, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { authClient, TOKEN_KEY, useAuth } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { DealerLogo } from "@/components/branding/DealerLogo";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { tenant } = useAuth();
  const isTenantBlocked = tenant?.tenantStatus === "suspended" || tenant?.tenantStatus === "inactive";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setIsLoading(true);
    try {
      const result = await authClient.signIn.username({
        username: username.trim(),
        password: password.trim(),
      });

      if (result.error) {
        toast({
          title: "Fehler",
          description: "Benutzername oder Passwort ist falsch.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Save the short token from response body (required for Bearer auth)
      const token = (result.data as { token?: string } | null)?.token;
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      }
      window.location.replace("/dashboard");
    } catch {
      toast({
        title: "Fehler",
        description: "Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(148,163,184,0.10),transparent)]" />

      <Card className="relative z-10 w-full max-w-md border-border/50 shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div>
            <div className="mb-4 flex justify-center">
              <DealerLogo
                src={tenant?.logoUrl}
                alt={tenant?.displayName ?? "Portal"}
                className="h-16 w-44"
                placeholderClassName="bg-muted"
              />
            </div>
            <div className="text-2xl font-semibold tracking-tight">
              {tenant?.displayName ?? "Autohaus Hub"}
            </div>
            <CardDescription className="mt-1.5 text-base">
              {tenant?.loginHeadline ?? "Melden Sie sich mit Ihren Zugangsdaten an."}
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
                Dieser Mandant ist derzeit nicht verfuegbar. Bitte wende dich an {tenant?.supportEmail ?? "den Support"}.
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isTenantBlocked || isLoading || !username.trim() || !password.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird angemeldet...
                </>
              ) : (
                "Anmelden"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
