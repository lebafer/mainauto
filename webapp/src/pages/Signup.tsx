import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { authClient, useAuth } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { CarOpsLogo } from "@/components/branding/CarOpsLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PlanSlug = "standard" | "pro";

type PublicPlan = {
  id: string;
  slug: PlanSlug;
  name: string;
  description?: string | null;
  monthlyPriceCents: number;
  trialDays: number;
  featureEntitlements: Record<string, boolean>;
  stripeConfigured: boolean;
};

const PLAN_FEATURES: Record<PlanSlug, string[]> = {
  standard: [
    "Fahrzeug-, Kunden- und Verkaufsverwaltung",
    "14 Tage Testphase",
    "Ein Owner-Zugang",
    "Cloud-Zugang unter CarOps",
  ],
  pro: [
    "Alles aus Standard",
    "Teamverwaltung für Mitarbeiter",
    "Eigenes Logo in Dokumenten",
    "KI-Fahrzeugbrief-Extraktion",
  ],
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);

export default function Signup() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<PlanSlug>("pro");
  const [form, setForm] = useState({
    companyName: "",
    ownerName: "",
    email: "",
    username: "",
    password: "",
  });

  const plansQuery = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => api.get<PublicPlan[]>("/api/public/plans"),
  });

  const selectedPlanData = useMemo(
    () => plansQuery.data?.find((plan) => plan.slug === selectedPlan) ?? null,
    [plansQuery.data, selectedPlan]
  );

  const signupMutation = useMutation({
    mutationFn: async () => {
      await api.post("/api/public/signup", {
        ...form,
        planSlug: selectedPlan,
      });

      const result = await authClient.signIn.username({
        username: form.username.trim(),
        password: form.password,
      });

      if (result.error) {
        const message =
          typeof result.error === "object" &&
          result.error !== null &&
          "message" in result.error &&
          typeof result.error.message === "string"
            ? result.error.message
            : "Anmeldung nach der Registrierung fehlgeschlagen.";
        throw new Error(message);
      }

    },
    onSuccess: () => {
      window.location.replace("/dashboard");
    },
    onError: (error) => {
      toast({
        title: "Registrierung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Bitte prüfe deine Angaben.",
        variant: "destructive",
      });
    },
  });

  if (session) {
    return <Navigate to={session.billing.requiresPayment ? "/billing" : "/dashboard"} replace />;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8ef_0%,#fff_35%,#fff_100%)] dark:bg-[linear-gradient(180deg,#09090b_0%,#0f172a_35%,#020617_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-6 py-8 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
        <div className="max-w-xl space-y-8">
          <div className="flex items-center justify-between">
            <CarOpsLogo />
            <Button asChild variant="ghost">
              <Link to="/login">Login</Link>
            </Button>
          </div>

          <div className="space-y-5">
            <Badge className="rounded-full bg-amber-500/15 px-4 py-1 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">
              14 Tage kostenlos testen
            </Badge>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">
                Starte CarOps für dein Autohaus.
              </h1>
              <p className="text-lg leading-8 text-slate-600 dark:text-slate-300">
                Lege dein Autohaus an, teste 14 Tage ohne Zahlungszwang und aktiviere dein Abo erst, wenn du bereit
                bist.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(plansQuery.data ?? []).map((plan) => {
              const isSelected = selectedPlan === plan.slug;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.slug)}
                  className={`rounded-3xl border p-5 text-left transition ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/10 shadow-[0_20px_60px_-40px_rgba(245,158,11,0.75)]"
                      : "border-border bg-card/70 hover:border-amber-400/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xl font-semibold">{plan.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{plan.description}</div>
                    </div>
                    {plan.slug === "pro" ? <Badge>Beliebt</Badge> : null}
                  </div>
                  <div className="mt-5 text-3xl font-semibold">{formatCurrency(plan.monthlyPriceCents)}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">pro Monat</div>
                  <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                    {PLAN_FEATURES[plan.slug].map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-amber-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Card className="w-full max-w-xl border-border/70 bg-card/85 shadow-2xl backdrop-blur">
          <CardHeader>
            <CardTitle>Account anlegen</CardTitle>
            <CardDescription>
              {selectedPlanData
                ? `${selectedPlanData.name} mit ${selectedPlanData.trialDays} Tagen Testphase.`
                : "Wähle einen Tarif und lege dein Autohaus an."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="companyName">Autohaus / Firma</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Dein Name</Label>
                <Input
                  id="ownerName"
                  value={form.ownerName}
                  onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Benutzername</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Mindestens 12 Zeichen. Leerzeichen am Anfang oder Ende gehören zum Passwort.
                </p>
              </div>
            </div>

            <Button
              size="lg"
              onClick={() => signupMutation.mutate()}
              disabled={
                signupMutation.isPending ||
                plansQuery.isLoading ||
                !form.companyName.trim() ||
                !form.ownerName.trim() ||
                !form.email.trim() ||
                !form.username.trim() ||
                form.password.length < 12
              }
              className="h-12"
            >
              {signupMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registriert...
                </>
              ) : (
                <>
                  Kostenlos starten
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-sm text-muted-foreground">
              Mit der Registrierung startet deine Testphase. Erst nach Ablauf der 14 Tage wird eine Zahlung für den
              weiteren Zugriff erforderlich.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
