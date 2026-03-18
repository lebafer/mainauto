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
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4fb_0%,#f8fbff_30%,#ffffff_100%)] text-slate-950 dark:bg-[linear-gradient(180deg,#020617_0%,#0b1730_40%,#020617_100%)] dark:text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between gap-4">
          <CarOpsLogo />
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild className="bg-[#19477e] text-white hover:bg-[#123965]">
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
            <Badge className="w-fit rounded-full bg-[#19477e]/10 px-4 py-1 text-[#19477e] hover:bg-[#19477e]/10 dark:text-[#c8dbf7]">
              SaaS für moderne Autohäuser
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
                CarOps ist das Betriebssystem für dein Autohaus.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Verwalte Bestand, Verkauf, Dokumente und dein Team in einer gemeinsamen Cloud-Plattform. Schnell
                startklar, klar bepreist und ohne versteckte Kosten.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-[#19477e]/10 bg-white/85 p-6 shadow-[0_30px_90px_-45px_rgba(25,71,126,0.42)] backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_center,rgba(94,129,173,0.2),transparent_70%)]" />
              <div className="relative flex items-center gap-5">
                <CarOpsLogo compact className="max-h-28 max-w-[22rem]" />
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#456792]">CarOps Cloud</div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-white">
                    Klar gebrandet, direkt startklar und ohne White-Label-Ballast.
                  </div>
                </div>
              </div>
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
                  title: "KI für Briefe",
                  body: "Pro liest Fahrzeugbriefe aus und spart dir manuelle Erfassung.",
                },
              ].map((item) => (
                <Card key={item.title} className="border-border/70 bg-card/75 shadow-xl backdrop-blur">
                  <CardHeader className="pb-3">
                    <item.icon className="h-5 w-5 text-[#19477e]" />
                    <CardTitle className="mt-3 text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{item.body}</CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-[#19477e] text-white hover:bg-[#123965]">
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
            <Card className="border-[#19477e]/15 bg-[linear-gradient(180deg,#0f2542_0%,#102d50_100%)] text-slate-50 shadow-2xl">
              <CardHeader>
                <CardTitle>Tarife</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {(plansQuery.data ?? []).map((plan) => (
                  <div key={plan.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xl font-semibold">{plan.name}</div>
                        <div className="mt-1 text-sm text-slate-300">{plan.description}</div>
                      </div>
                    </div>
                    <div className="mt-5 text-4xl font-semibold">{formatCurrency(plan.monthlyPriceCents)}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">pro Monat</div>
                    <div className="mt-5 space-y-3 text-sm text-slate-300">
                      {(plan.slug === "pro"
                        ? ["Teamverwaltung", "Dokumentenbranding", "KI-Fahrzeugbrief-Extraktion"]
                        : ["Fahrzeugverwaltung", "CRM und Verkauf", "14 Tage Testphase"])
                        .map((feature) => (
                          <div key={feature} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#7fb0f4]" />
                            <span>{feature}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl border border-[#7fb0f4]/25 bg-[#7fb0f4]/10 p-4 text-sm text-slate-200">
                  Testphase: 14 Tage. Zahlung erst nötig, wenn du danach weiternutzen willst.
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </main>
      </div>
    </div>
  );
}
