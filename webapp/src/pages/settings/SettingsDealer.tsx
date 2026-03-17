import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-client";
import { DealerLogo } from "@/components/branding/DealerLogo";
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
  faviconUrl: "",
  primaryColor: "",
  accentColor: "",
  loginHeadline: "",
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

  const settingsQuery = useQuery({
    queryKey: ["dealer-settings"],
    queryFn: () => api.get<DealerSettingsResponse>("/api/settings/dealer"),
    enabled: session?.dealerRole === "dealer_owner" || session?.dealerRole === "dealer_admin",
  });

  useEffect(() => {
    const settings = settingsQuery.data?.settings;
    if (!settings) return;

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
      faviconUrl: String(settings.faviconUrl ?? ""),
      primaryColor: String(settings.primaryColor ?? ""),
      accentColor: String(settings.accentColor ?? ""),
      loginHeadline: String(settings.loginHeadline ?? ""),
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
      toast({ title: "Logo hochgeladen", description: "Das Händlerlogo wurde aktualisiert." });
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
      toast({ title: "Logo entfernt", description: "Das Händlerlogo wurde entfernt." });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Logo konnte nicht entfernt werden.",
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
            faviconUrl: "Favicon-URL",
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

          <div className="space-y-3 md:col-span-2">
            <Label>Logo</Label>
            <div className="flex flex-col gap-4 rounded-lg border border-dashed p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <DealerLogo
                  src={form.logoUrl}
                  alt="Händlerlogo"
                  className="h-20 w-44 rounded-md bg-muted/20 p-2"
                  placeholderClassName="border-border bg-muted"
                />
                <div className="text-sm text-muted-foreground">
                  PNG, JPG oder WebP hochladen. Das Logo wird direkt für Sidebar und Dokumente genutzt.
                </div>
              </div>
              <div className="flex flex-col gap-2 md:min-w-[220px]">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => logoFile && logoUploadMutation.mutate(logoFile)}
                  disabled={!logoFile || logoUploadMutation.isPending}
                >
                  {logoUploadMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Lädt hoch...
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
                  disabled={!form.logoUrl || removeLogoMutation.isPending || logoUploadMutation.isPending}
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

          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primärfarbe</Label>
            <div className="flex items-center gap-3">
              <Input
                id="primaryColorPicker"
                type="color"
                value={form.primaryColor || "#f59e0b"}
                onChange={(event) => setForm((current) => ({ ...current, primaryColor: event.target.value }))}
                className="h-10 w-16 cursor-pointer p-1"
              />
              <Input
                id="primaryColor"
                value={form.primaryColor}
                onChange={(event) => setForm((current) => ({ ...current, primaryColor: event.target.value }))}
                placeholder="#f59e0b"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accentColor">Akzentfarbe</Label>
            <div className="flex items-center gap-3">
              <Input
                id="accentColorPicker"
                type="color"
                value={form.accentColor || "#111827"}
                onChange={(event) => setForm((current) => ({ ...current, accentColor: event.target.value }))}
                className="h-10 w-16 cursor-pointer p-1"
              />
              <Input
                id="accentColor"
                value={form.accentColor}
                onChange={(event) => setForm((current) => ({ ...current, accentColor: event.target.value }))}
                placeholder="#111827"
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="loginHeadline">Login-Headline</Label>
            <Textarea
              id="loginHeadline"
              value={form.loginHeadline}
              onChange={(event) => setForm((current) => ({ ...current, loginHeadline: event.target.value }))}
              placeholder="Kurzer Satz fuer die Login-Seite deines White-Label-Portals"
            />
          </div>
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
