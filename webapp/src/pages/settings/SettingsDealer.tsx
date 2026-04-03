import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-client";
import { DealerLogo } from "@/components/branding/DealerLogo";
import { DealerWebsiteFeedCard } from "@/components/settings/DealerWebsiteFeedCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  displayName: "",
  legalName: "",
  addressLine1: "",
  zip: "",
  city: "",
  country: "",
  phone: "",
  email: "",
  supportEmail: "",
  website: "",
  taxId: "",
  legalRepresentative: "",
  bankName: "",
  iban: "",
  bic: "",
  logoUrl: "",
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const canManageDealerSettings = session?.dealerRole === "dealer_owner" || session?.dealerRole === "dealer_admin";
  const documentBrandingEnabled = session?.entitlements?.document_branding === true;

  const settingsQuery = useQuery({
    queryKey: ["dealer-settings"],
    queryFn: () => api.get<DealerSettingsResponse>("/api/settings/dealer"),
    enabled: canManageDealerSettings,
  });

  useEffect(() => {
    const settings = settingsQuery.data?.settings;
    if (!settings) {
      return;
    }

    setForm({
      displayName: String(settings.displayName ?? ""),
      legalName: String(settings.legalName ?? ""),
      addressLine1: String(settings.addressLine1 ?? ""),
      zip: String(settings.zip ?? ""),
      city: String(settings.city ?? ""),
      country: String(settings.country ?? ""),
      phone: String(settings.phone ?? ""),
      email: String(settings.email ?? ""),
      supportEmail: String(settings.supportEmail ?? ""),
      website: String(settings.website ?? ""),
      taxId: String(settings.taxId ?? ""),
      legalRepresentative: String(settings.legalRepresentative ?? ""),
      bankName: String(settings.bankName ?? ""),
      iban: String(settings.iban ?? ""),
      bic: String(settings.bic ?? ""),
      logoUrl: String(settings.logoUrl ?? ""),
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
      toast({ title: "Gespeichert", description: "Unternehmensdaten wurden aktualisiert." });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Speichern fehlgeschlagen.",
        variant: "destructive",
      });
    },
  });

  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${baseUrl}/api/settings/dealer/logo`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error?.message || "Logo konnte nicht hochgeladen werden.");
      }

      return response.json();
    },
    onSuccess: async () => {
      setLogoFile(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["dealer-settings"] }), refetch()]);
      toast({ title: "Logo hochgeladen", description: "Das Dokumentenlogo wurde aktualisiert." });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Logo-Upload fehlgeschlagen.",
        variant: "destructive",
      });
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: () => api.delete<{ logoUrl: null }>("/api/settings/dealer/logo"),
    onSuccess: async () => {
      setLogoFile(null);
      setForm((current) => ({ ...current, logoUrl: "" }));
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["dealer-settings"] }), refetch()]);
      toast({ title: "Logo entfernt", description: "Das Dokumentenlogo wurde entfernt." });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Logo konnte nicht entfernt werden.",
        variant: "destructive",
      });
    },
  });

  if (!canManageDealerSettings) {
    return <div className="text-sm text-muted-foreground">Kein Zugriff auf diese Seite.</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Unternehmensprofil</CardTitle>
            <CardDescription>Diese Daten gelten für dein Autohaus und fliessen in Dokumente und Stammdaten ein.</CardDescription>
          </div>
          <Badge variant="outline">{session.subscription?.plan?.name ?? "Kein Tarif"}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {Object.entries({
            displayName: "Anzeigename",
            legalName: "Firmenname",
            addressLine1: "Adresse",
            zip: "PLZ",
            city: "Ort",
            country: "Land",
            phone: "Telefon",
            email: "E-Mail",
            supportEmail: "Support-E-Mail",
            website: "Website",
            taxId: "USt-Id",
            legalRepresentative: "Vertretungsberechtigt",
            bankName: "Bank",
            iban: "IBAN",
            bic: "BIC",
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

      <DealerWebsiteFeedCard canManage={canManageDealerSettings} />

      <Card>
        <CardHeader>
          <CardTitle>Dokumentenbranding</CardTitle>
          <CardDescription>
            Eigenes Logo und individuelle Rechtstexte sind nur im Pro-Tarif verfuegbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!documentBrandingEnabled ? (
            <Alert>
              <AlertTitle>Pro-Feature</AlertTitle>
              <AlertDescription>
                Upgrade auf Pro, um dein Autohaus-Logo in Dokumenten zu verwenden und eigene Dokumententexte zu
                hinterlegen.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-3">
            <Label>Dokumentenlogo</Label>
            <div className="flex flex-col gap-4 rounded-2xl border border-dashed p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <DealerLogo
                  src={form.logoUrl}
                  alt="Dokumentenlogo"
                  className="h-20 w-44 rounded-md bg-muted/20 p-2"
                  placeholderClassName="border-border bg-muted"
                />
                <div className="text-sm text-muted-foreground">
                  Dieses Logo erscheint nur in deinen generierten Dokumenten, nicht im CarOps-Login oder in der App.
                </div>
              </div>
              <div className="flex flex-col gap-2 md:min-w-[240px]">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                  disabled={!documentBrandingEnabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => logoFile && logoUploadMutation.mutate(logoFile)}
                  disabled={!documentBrandingEnabled || !logoFile || logoUploadMutation.isPending}
                >
                  {logoUploadMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Laedt hoch...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Logo hochladen
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeLogoMutation.mutate()}
                  disabled={
                    !documentBrandingEnabled ||
                    !form.logoUrl ||
                    removeLogoMutation.isPending ||
                    logoUploadMutation.isPending
                  }
                >
                  {removeLogoMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entfernt...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Logo entfernen
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              ["documentFooterText", "Dokument-Fusszeile"],
              ["documentLegalText", "Rechtstext"],
              ["purchaseTerms", "Ankaufsbedingungen"],
              ["saleTerms", "Verkaufsbedingungen"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Textarea
                  id={key}
                  rows={4}
                  value={form[key as keyof typeof form]}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  disabled={!documentBrandingEnabled}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full md:w-fit">
        {saveMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Speichert...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Aenderungen speichern
          </>
        )}
      </Button>
    </div>
  );
}
