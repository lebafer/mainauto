import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Building2, Globe, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-client";
import { submitOnboardingInquiry } from "@/lib/tenant-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DealerLogo } from "@/components/branding/DealerLogo";

const EMPTY_FORM = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  notes: "",
};

export default function LandingPage() {
  const { session, tenant } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);

  const inquiryMutation = useMutation({
    mutationFn: () => submitOnboardingInquiry(form),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      toast({
        title: "Anfrage gesendet",
        description: "Wir melden uns mit den naechsten Schritten fuer dein White-Label-Setup.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Anfrage konnte nicht gesendet werden.",
        variant: "destructive",
      });
    },
  });

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  const isDealerHost = Boolean(tenant?.dealer);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_30%),linear-gradient(180deg,#09090b,#0f172a_38%,#111827)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-40 items-center">
              <DealerLogo
                src={tenant?.logoUrl}
                alt={tenant?.displayName ?? "Autohaus Hub"}
                className="h-12 w-full"
                placeholderClassName="border-white/10 bg-white/5 text-white/70"
              />
            </div>
            <div className="hidden text-sm text-slate-300 md:block">
              {tenant?.displayName ?? "White-Label-Autohaussoftware"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <Link to="/login">Login</Link>
            </Button>
            {!isDealerHost ? (
              <Button asChild className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                <a href="#anfrage">Demo anfragen</a>
              </Button>
            ) : null}
          </div>
        </header>

        <main className="grid flex-1 gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-200">
              {isDealerHost ? "Mandantenportal" : "White-Label V1"}
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                {isDealerHost
                  ? tenant?.displayName ?? "Autohaus-Portal"
                  : "Autohaussoftware als vermietbares White-Label-Produkt"}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                {isDealerHost
                  ? tenant?.loginHeadline ??
                    "Bestand, Verkauf, Dokumente und Teamzugriff unter deiner eigenen Marke."
                  : "Eine zentrale SaaS-Plattform fuer kleine Autohaeuser mit eigener Marke, eigener Subdomain und sauberem Onboarding."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Building2,
                  title: "Mandantenfaehig",
                  body: "Haendler, Teams, Daten und Branding bleiben sauber getrennt.",
                },
                {
                  icon: Globe,
                  title: "Eigene Subdomain",
                  body: "Jeder Kunde kann sein Portal spaeter unter app.kunde.de anbinden.",
                },
                {
                  icon: ShieldCheck,
                  title: "Kontrolliertes Onboarding",
                  body: "V1 bleibt manuell und damit im Betrieb beherrschbar.",
                },
              ].map((item) => (
                <Card key={item.title} className="border-white/10 bg-white/5 text-white shadow-xl backdrop-blur">
                  <CardHeader className="pb-3">
                    <item.icon className="h-5 w-5 text-amber-300" />
                    <CardTitle className="mt-3 text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-300">{item.body}</CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                <Link to="/login">
                  Zum Login
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              {!isDealerHost ? (
                <Button asChild size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <a href="#anfrage">White-Label anfragen</a>
                </Button>
              ) : null}
            </div>
          </section>

          <section id="anfrage">
            {isDealerHost ? (
              <Card className="border-white/10 bg-white/5 text-white shadow-2xl backdrop-blur">
                <CardHeader>
                  <CardTitle>Portal-Zugang</CardTitle>
                  <CardDescription className="text-slate-300">
                    Dieses Portal ist fuer {tenant?.displayName ?? "dein Autohaus"} vorbereitet. Melde dich mit deinen Zugangsdaten an oder kontaktiere den Support.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button asChild className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400">
                    <Link to="/login">Zum Login</Link>
                  </Button>
                  <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                    Support: {tenant?.supportEmail ?? "support@autohaus-hub.local"}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-white/10 bg-white/5 text-white shadow-2xl backdrop-blur">
                <CardHeader>
                  <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-amber-200">
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    White-Label Anfrage
                  </div>
                  <CardTitle className="mt-4">Onboarding anfragen</CardTitle>
                  <CardDescription className="text-slate-300">
                    Hinterlasse uns die wichtigsten Daten. Wir richten danach Demo, Tarif und White-Label-Setup manuell fuer dich ein.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {[
                    ["businessName", "Autohaus / Firma"],
                    ["contactName", "Ansprechpartner"],
                    ["email", "E-Mail"],
                    ["phone", "Telefon"],
                    ["website", "Website"],
                  ].map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key} className="text-slate-200">
                        {label}
                      </Label>
                      <Input
                        id={key}
                        type={key === "email" ? "email" : "text"}
                        value={form[key as keyof typeof form]}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, [key]: event.target.value }))
                        }
                        className="border-white/10 bg-slate-950/40 text-white placeholder:text-slate-500"
                      />
                    </div>
                  ))}
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-slate-200">
                      Was benoetigst du?
                    </Label>
                    <Textarea
                      id="notes"
                      value={form.notes}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                      className="min-h-[120px] border-white/10 bg-slate-950/40 text-white placeholder:text-slate-500"
                      placeholder="z. B. Anzahl Mitarbeiter, gewuenschte Prozesse, spaetere Wunschdomain"
                    />
                  </div>
                  <Button
                    onClick={() => inquiryMutation.mutate()}
                    disabled={
                      inquiryMutation.isPending ||
                      !form.businessName.trim() ||
                      !form.contactName.trim() ||
                      !form.email.trim()
                    }
                    className="bg-amber-500 text-slate-950 hover:bg-amber-400"
                  >
                    {inquiryMutation.isPending ? "Wird gesendet..." : "Anfrage absenden"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
