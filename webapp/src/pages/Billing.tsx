import { useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock3, CreditCard, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  standard: ["Core-CRM und Fahrzeugverwaltung", "1 Owner-Zugang", "Cloud-Zugang unter CarOps"],
  pro: [
    "Teamverwaltung",
    "Dokumentenbranding mit Autohaus-Logo",
    "KI-Fahrzeugbrief-Extraktion",
    "Vertriebskanäle mit AutoScout24",
  ],
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);

function getTrialDaysRemaining(trialEndsAt: string | null) {
  if (!trialEndsAt) {
    return 0;
  }

  const diffMs = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export default function Billing() {
  const { session, refetch } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const plansQuery = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => api.get<PublicPlan[]>("/api/public/plans"),
  });

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");
    if (!checkoutState) {
      return;
    }

    void refetch();

    if (checkoutState === "success") {
      toast({ title: "Checkout abgeschlossen", description: "Dein Tarif wird gerade aktualisiert." });
    }

    if (checkoutState === "cancelled") {
      toast({ title: "Checkout abgebrochen", description: "Du kannst spaeter jederzeit weitermachen." });
    }
  }, [refetch, searchParams, toast]);

  const checkoutMutation = useMutation({
    mutationFn: async (planSlug: PlanSlug) =>
      api.post<{ url: string }>("/api/billing/checkout", {
        planSlug,
        returnPath: "/billing",
      }),
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
    onError: (error) => {
      toast({
        title: "Checkout nicht verfuegbar",
        description: error instanceof Error ? error.message : "Bitte versuche es spaeter erneut.",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () =>
      api.post<{ url: string }>("/api/billing/portal", {
        returnPath: "/billing",
      }),
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
    onError: (error) => {
      toast({
        title: "Billing-Portal nicht verfuegbar",
        description: error instanceof Error ? error.message : "Bitte versuche es spaeter erneut.",
        variant: "destructive",
      });
    },
  });

  const currentPlanSlug = (session?.subscription?.plan?.slug as PlanSlug | undefined) ?? "standard";
  const daysRemaining = getTrialDaysRemaining(session?.billing.trialEndsAt ?? null);
  const currentPlan = useMemo(
    () => plansQuery.data?.find((plan) => plan.slug === currentPlanSlug) ?? null,
    [currentPlanSlug, plansQuery.data]
  );

  if (!session) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-card/85 shadow-xl">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full bg-amber-500/15 px-4 py-1 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">
                {session.billing.isComplimentary
                  ? "Kostenlos freigeschaltet"
                  : session.billing.requiresPayment
                    ? "Zahlung erforderlich"
                    : session.subscription?.plan?.name ?? "Tarif aktiv"}
              </Badge>
              {session.billing.status === "trialing" ? (
                <Badge variant="outline" className="rounded-full">
                  {daysRemaining} Tage Testphase
                </Badge>
              ) : null}
            </div>
            <div className="space-y-3">
              <CardTitle className="text-3xl">
                {session.billing.isComplimentary
                  ? `${session.subscription?.plan?.name ?? "CarOps"} ist kostenlos für dieses Autohaus freigeschaltet.`
                  : session.billing.requiresPayment
                  ? "Dein Zugang ist aktuell hinter der Paywall."
                  : `Du nutzt gerade ${session.subscription?.plan?.name ?? "CarOps"}.`}
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7">
                {session.billing.isComplimentary
                  ? "Dieses Autohaus wurde im Adminbereich kostenlos freigeschaltet. Stripe ist deshalb für den Zugriff aktuell nicht nötig."
                  : session.billing.requiresPayment
                  ? "Waehle jetzt einen Tarif und aktiviere dein Abo, damit du wieder voll auf dein Autohaus zugreifen kannst."
                  : "Verwalte hier Testphase, Upgrade und dein Zahlungsprofil. Alle Tarifwechsel laufen direkt ueber Stripe."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Clock3,
                title: "Testphase",
                text:
                  session.billing.status === "trialing"
                    ? `${daysRemaining} Tage verbleiben bis zur Paywall.`
                    : "Keine aktive Testphase mehr.",
              },
              {
                icon: ShieldCheck,
                title: "Aktueller Tarif",
                text: currentPlan
                  ? session.billing.isComplimentary
                    ? `${currentPlan.name} ist kostenlos freigeschaltet.`
                    : `${currentPlan.name} für ${formatCurrency(currentPlan.monthlyPriceCents)} / Monat`
                  : "Noch kein Tarif aktiv.",
              },
              {
                icon: Sparkles,
                title: "Pro-Vorteile",
                text: "Teamverwaltung, Dokumentenbranding und KI-Briefscan.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <item.icon className="h-5 w-5 text-amber-500" />
                <div className="mt-3 font-medium">{item.title}</div>
                <div className="mt-2 text-sm text-muted-foreground">{item.text}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-slate-950 text-slate-50 shadow-2xl">
          <CardHeader>
            <CardTitle>Billing-Aktionen</CardTitle>
            <CardDescription className="text-slate-300">
              Checkout startet sofort. Wenn Stripe bereits verbunden ist, kannst du dein Abo danach selbst verwalten.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button
              onClick={() => checkoutMutation.mutate("standard")}
              disabled={checkoutMutation.isPending}
              variant="secondary"
              className="justify-between"
            >
              Standard aktivieren
              {checkoutMutation.isPending && checkoutMutation.variables === "standard" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={() => checkoutMutation.mutate("pro")}
              disabled={checkoutMutation.isPending}
              className="justify-between bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              Pro aktivieren
              {checkoutMutation.isPending && checkoutMutation.variables === "pro" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending || !session.subscription?.stripeCustomerId}
            >
              {portalMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Oeffnet Portal...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Stripe Billing Portal
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {session.billing.requiresPayment ? (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTitle>Zugang pausiert</AlertTitle>
          <AlertDescription>
            Deine Testphase ist abgelaufen oder dein Abo ist nicht aktiv. Nach erfolgreicher Zahlung ist dein Zugriff
            wieder sofort offen.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {(plansQuery.data ?? []).map((plan) => {
          const isCurrent = currentPlanSlug === plan.slug;
          return (
            <Card key={plan.id} className={isCurrent ? "border-amber-500/60 shadow-lg" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </div>
                  {isCurrent ? <Badge>Aktiv</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-semibold">{formatCurrency(plan.monthlyPriceCents)}</div>
                <div className="text-sm uppercase tracking-[0.16em] text-muted-foreground">pro Monat</div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {PLAN_FEATURES[plan.slug].map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-amber-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => checkoutMutation.mutate(plan.slug)}
                  disabled={checkoutMutation.isPending || isCurrent}
                  className="w-full"
                  variant={plan.slug === "pro" ? "default" : "outline"}
                >
                  {isCurrent ? "Aktuell aktiv" : `${plan.name} waehlen`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
