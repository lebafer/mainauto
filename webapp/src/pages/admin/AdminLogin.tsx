import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, fetchSession } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-client";

export default function AdminLogin() {
  const { session, isPending } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session?.user.platformRole === "platform_super_admin") {
    return <Navigate to="/admin/dealers" replace />;
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || password.length === 0) return;

    setIsLoading(true);

    try {
      const result = await authClient.signIn.username({
        username: username.trim(),
        password,
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

      const nextSession = await fetchSession();
      if (nextSession?.user.platformRole !== "platform_super_admin") {
        await authClient.signOut().catch(() => undefined);
        throw new Error("Dieser Zugang hat keinen Superadmin-Zugriff.");
      }

      window.location.replace("/admin/dealers");
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Admin-Anmeldung fehlgeschlagen.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.2),transparent_40%),linear-gradient(to_bottom,#08101d,#111827)] p-4">
      <Card className="w-full max-w-md border-[#7fb0f4]/20 bg-slate-950/80 text-white shadow-2xl backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#7fb0f4]/30 bg-[#7fb0f4]/10">
            <ShieldCheck className="h-8 w-8 text-[#c8dbf7]" />
          </div>
          <div>
            <CardTitle className="text-2xl">Superadmin Login</CardTitle>
            <CardDescription className="mt-2 text-slate-300">
              Autohäuser anlegen, Tarife setzen und Branding verwalten.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="admin-username" className="text-slate-200">
                Benutzername
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="admin-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="border-white/10 bg-white/5 pl-10 text-white"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-slate-200">
                Passwort
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-white/10 bg-white/5 pl-10 text-white"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#7fb0f4] text-slate-950 hover:bg-[#9bc1f6]" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird angemeldet...
                </>
              ) : (
                "Zum Adminbereich"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
