import { Navigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Building2, CheckCircle2, Users2 } from "lucide-react";
import { useAuth } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CarOpsLogo } from "@/components/branding/CarOpsLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PlanSlug = "standard" | "pro";

type PublicPlan = {
  id: string;
  slug: PlanSlug;
  name: string;
  description?: string | null;
  monthlyPriceCents: number;
  trialDays: number;
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);

export default function LandingPage() {
  const { session } = useAuth();
  const plansQuery = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => api.get<PublicPlan[]>("/api/public/plans"),
  });

  if (session) {
    return <Navigate to={session.billing.requiresPayment ? "/billing" : "/dashboard"} replace />;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8ef_0%,#fff_35%,#fff_100%)] text-slate-950 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_40%,#020617_100%)] dark:text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between gap-4">
          <CarOpsLogo />
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild className="bg-amber-500 text-slate-950 hover:bg-amber-400">
              <Link to="/signup">Kostenlos starten</Link>
            </Button>
          </div>
        </header>

        <main className="grid flex-1 gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="space-y-8"
          >
            <Badge className="w-fit rounded-full bg-amber-500/15 px-4 py-1 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">
              SaaS fuer moderne Autohäuser
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
                CarOps ist das Betriebssystem fuer dein Autohaus.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Verwalte Bestand, Verkauf, Dokumente und dein Team in einer gemeinsamen Cloud-Plattform. Schnell
                startklar, klar bepreist und ohne zusaetzliche Setup-Schleifen.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Building2,
                  title: "Autohaus-ready",
                  body: "Fahrzeuge, Kunden, Verkauf und Dokumente in einem System.",
                },
                {
                  icon: Users2,
                  title: "Team im Blick",
                  body: "Owner, Admins und Mitarbeiter arbeiten mit klaren Rollen.",
                },
                {
                  icon: Bot,
                  title: "KI fuer Briefe",
                  body: "Pro liest Fahrzeugbriefe aus und spart dir manuelle Erfassung.",
                },
              ].map((item) => (
                <Card key={item.title} className="border-border/70 bg-card/75 shadow-xl backdrop-blur">
                  <CardHeader className="pb-3">
                    <item.icon className="h-5 w-5 text-amber-500" />
                    <CardTitle className="mt-3 text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{item.body}</CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                <Link to="/signup">
                  Jetzt kostenlos starten
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Zum Login</Link>
              </Button>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="space-y-4"
          >
            <Card className="border-border/70 bg-slate-950 text-slate-50 shadow-2xl">
              <CardHeader>
                <CardTitle>Tarife fuer v1</CardTitle>
                <CardDescription className="text-slate-300">
                  Gleicher Einstieg fuer alle. Keine Sonderkonfigurationen, keine Extrarunden, einfach loslegen.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {(plansQuery.data ?? []).map((plan) => (
                  <div key={plan.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xl font-semibold">{plan.name}</div>
                        <div className="mt-1 text-sm text-slate-300">{plan.description}</div>
                      </div>
                      {plan.slug === "pro" ? <Badge className="bg-amber-500 text-slate-950">Pro</Badge> : null}
                    </div>
                    <div className="mt-5 text-4xl font-semibold">{formatCurrency(plan.monthlyPriceCents)}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">pro Monat</div>
                    <div className="mt-5 space-y-3 text-sm text-slate-300">
                      {(plan.slug === "pro"
                        ? ["Teamverwaltung", "Dokumentenbranding", "KI-Fahrzeugbrief-Extraktion"]
                        : ["Fahrzeugverwaltung", "CRM und Verkauf", "14 Tage Testphase"])
                        .map((feature) => (
                          <div key={feature} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-amber-400" />
                            <span>{feature}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-slate-200">
                  Testphase: 14 Tage. Zahlung erst noetig, wenn du danach weiternutzen willst.
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-lg">Schneller Start</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Registrierung, Trial und Checkout laufen im selben SaaS-Flow.
                </CardContent>
              </Card>
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-lg">Saubere Abrechnung</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Upgrade, Aboverwaltung und Paywall sind direkt im Produkt verankert.
                </CardContent>
              </Card>
            </div>
          </motion.section>
        </main>
      </div>
    </div>
  );
}
