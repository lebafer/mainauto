import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DealerSettingsResponse = {
  dealer: {
    id: string;
    name: string;
    slug: string;
    status: string;
    isDefault: boolean;
  };
  settings: Record<string, string | null> | null;
};

const EMPTY_FORM = {
  legalName: "",
  addressLine1: "",
  zip: "",
  city: "",
  country: "",
  phone: "",
  email: "",
  website: "",
  taxId: "",
  legalRepresentative: "",
  bankName: "",
  iban: "",
  bic: "",
  logoUrl: "",
  primaryColor: "",
  accentColor: "",
  documentFooterText: "",
  documentLegalText: "",
  purchaseTerms: "",
  saleTerms: "",
};

export default function SettingsDealer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session, refetch } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);

  const settingsQuery = useQuery({
    queryKey: ["dealer-settings"],
    queryFn: () => api.get<DealerSettingsResponse>("/api/settings/dealer"),
    enabled: session?.dealerRole === "dealer_owner" || session?.dealerRole === "dealer_admin",
  });

  useEffect(() => {
    const settings = settingsQuery.data?.settings;
    if (!settings) return;

    setForm({
      legalName: String(settings.legalName ?? ""),
      addressLine1: String(settings.addressLine1 ?? ""),
      zip: String(settings.zip ?? ""),
      city: String(settings.city ?? ""),
      country: String(settings.country ?? ""),
      phone: String(settings.phone ?? ""),
      email: String(settings.email ?? ""),
      website: String(settings.website ?? ""),
      taxId: String(settings.taxId ?? ""),
      legalRepresentative: String(settings.legalRepresentative ?? ""),
      bankName: String(settings.bankName ?? ""),
      iban: String(settings.iban ?? ""),
      bic: String(settings.bic ?? ""),
      logoUrl: String(settings.logoUrl ?? ""),
      primaryColor: String(settings.primaryColor ?? ""),
      accentColor: String(settings.accentColor ?? ""),
      documentFooterText: String(settings.documentFooterText ?? ""),
      documentLegalText: String(settings.documentLegalText ?? ""),
      purchaseTerms: String(settings.purchaseTerms ?? ""),
      saleTerms: String(settings.saleTerms ?? ""),
    });
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => api.put("/api/settings/dealer", form),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["dealer-settings"] }), refetch()]);
      toast({ title: "Gespeichert", description: "Händler-Einstellungen wurden aktualisiert." });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Speichern fehlgeschlagen.",
        variant: "destructive",
      });
    },
  });

  if (!(session?.dealerRole === "dealer_owner" || session?.dealerRole === "dealer_admin")) {
    return <div className="text-sm text-muted-foreground">Kein Zugriff auf diese Seite.</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Händlerprofil</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {Object.entries({
            legalName: "Firmenname",
            addressLine1: "Adresse",
            zip: "PLZ",
            city: "Ort",
            country: "Land",
            phone: "Telefon",
            email: "E-Mail",
            website: "Website",
            taxId: "USt-Id",
            legalRepresentative: "Vertretungsberechtigt",
            bankName: "Bank",
            iban: "IBAN",
            bic: "BIC",
            logoUrl: "Logo-URL",
            primaryColor: "Primärfarbe",
            accentColor: "Akzentfarbe",
          }).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dokumenttexte</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {[
            ["documentFooterText", "Dokument-Fußzeile"],
            ["documentLegalText", "Rechtstext"],
            ["purchaseTerms", "Ankaufsbedingungen"],
            ["saleTerms", "Verkaufsbedingungen"],
          ].map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Textarea
                id={key}
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                rows={4}
              />
            </div>
          ))}
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full md:w-fit">
            <Save className="mr-2 h-4 w-4" />
            Änderungen speichern
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
