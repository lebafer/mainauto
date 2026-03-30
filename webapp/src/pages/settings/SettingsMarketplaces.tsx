import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, PlugZap } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import type { MarketplaceCustomerInfo, MarketplaceOverviewResponse } from "@/lib/marketplaces";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const DEFAULT_TIMEZONE = "Europe/Berlin";

export default function SettingsMarketplaces() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [verifiedCustomers, setVerifiedCustomers] = useState<MarketplaceCustomerInfo[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<"hourly" | "daily">("hourly");
  const [scheduleHour, setScheduleHour] = useState("8");
  const [scheduleMinute, setScheduleMinute] = useState("0");

  const canManage =
    session?.dealerRole === "dealer_owner" || session?.dealerRole === "dealer_admin";
  const featureEnabled = session?.entitlements?.marketplace_exports === true;

  const overviewQuery = useQuery({
    queryKey: ["marketplaces-overview"],
    queryFn: () => api.get<MarketplaceOverviewResponse>("/api/marketplaces"),
    enabled: canManage && featureEnabled,
  });

  const autoscoutConnection = useMemo(
    () => overviewQuery.data?.connections.find((connection) => connection.platform === "autoscout24") ?? null,
    [overviewQuery.data]
  );
  const autoscoutSchedule = useMemo(
    () => overviewQuery.data?.schedules.find((schedule) => schedule.platform === "autoscout24") ?? null,
    [overviewQuery.data]
  );

  useEffect(() => {
    if (!autoscoutConnection) {
      return;
    }

    setUsername(autoscoutConnection.username ?? "");
    setCustomerId(autoscoutConnection.customerId ?? "");
  }, [autoscoutConnection]);

  useEffect(() => {
    if (!autoscoutSchedule) {
      return;
    }

    setScheduleEnabled(autoscoutSchedule.enabled);
    setScheduleFrequency(autoscoutSchedule.frequency);
    setScheduleHour(String(autoscoutSchedule.hour));
    setScheduleMinute(String(autoscoutSchedule.minute));
  }, [autoscoutSchedule]);

  const verifyMutation = useMutation({
    mutationFn: () =>
      api.post<{
        platform: "autoscout24";
        username: string;
        customers: MarketplaceCustomerInfo[];
      }>("/api/marketplaces/verify", {
        platform: "autoscout24",
        username,
        password,
      }),
    onSuccess: (data) => {
      setVerifiedCustomers(data.customers);
      if (data.customers.length === 1) {
        setCustomerId(data.customers[0]?.id ?? "");
      }
      toast({
        title: "AutoScout24 geprüft",
        description: `${data.customers.length} Kundenkonto/Konten gefunden.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Verbindung fehlgeschlagen",
        description: error instanceof Error ? error.message : "AutoScout24 konnte nicht verifiziert werden.",
        variant: "destructive",
      });
    },
  });

  const saveConnectionMutation = useMutation({
    mutationFn: () =>
      api.put("/api/marketplaces/connection", {
        platform: "autoscout24",
        username,
        password,
        customerId: customerId || undefined,
        displayName: "AutoScout24",
      }),
    onSuccess: async () => {
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: ["marketplaces-overview"] });
      toast({
        title: "Verbindung gespeichert",
        description: "AutoScout24 ist jetzt als Vertriebskanal hinterlegt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Speichern fehlgeschlagen",
        description: error instanceof Error ? error.message : "Die Verbindung konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: () =>
      api.put("/api/marketplaces/schedules", {
        platform: "autoscout24",
        enabled: scheduleEnabled,
        frequency: scheduleFrequency,
        hour: Number(scheduleHour),
        minute: Number(scheduleMinute),
        timezone: DEFAULT_TIMEZONE,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["marketplaces-overview"] });
      toast({
        title: "Automatik gespeichert",
        description: "Die Upload-Planung wurde aktualisiert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Automatik fehlgeschlagen",
        description: error instanceof Error ? error.message : "Die Planung konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    },
  });

  if (!canManage) {
    return <div className="text-sm text-muted-foreground">Kein Zugriff auf diese Seite.</div>;
  }

  if (!featureEnabled) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Vertriebskanäle</CardTitle>
            <CardDescription>
              AutoScout24, spätere weitere Plattformen und automatische Uploads sind im Pro-Tarif enthalten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Pro-Feature</AlertTitle>
              <AlertDescription>
                Mit Pro kannst du Plattformen verbinden, Fahrzeuge markieren, Uploads steuern und automatische Exporte
                planen.
              </AlertDescription>
            </Alert>
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Vorgesehene Bereiche:
              Verbindung einrichten, customerId wählen, Upload-Status verfolgen und stündliche oder tägliche
              Aktualisierung planen.
            </div>
            <Button asChild>
              <Link to="/billing">Auf Pro upgraden</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Vertriebskanäle</CardTitle>
            <CardDescription>
              Verbinde externe Plattformen, verwalte deine AutoScout24-Zugangsdaten und steuere automatische Uploads.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link to="/marketplaces/uploads">Zur Upload-Zentrale</Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <PlugZap className="h-5 w-5 text-amber-500" />
            <div>
              <CardTitle>AutoScout24</CardTitle>
              <CardDescription>
                AutoScout24 nutzt Data-Provider/API-Zugangsdaten plus customerId pro Autohaus.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={autoscoutConnection?.status === "connected" ? "default" : "outline"}>
              {autoscoutConnection?.status === "connected" ? "Verbunden" : "Nicht vollständig eingerichtet"}
            </Badge>
            {autoscoutConnection?.lastVerifiedAt ? (
              <span className="text-xs text-muted-foreground">
                Zuletzt geprüft: {new Date(autoscoutConnection.lastVerifiedAt).toLocaleString("de-DE")}
              </span>
            ) : null}
          </div>

          <Alert>
            <AlertTitle>So richtest du AutoScout24 ein</AlertTitle>
            <AlertDescription>
              Trage hier die separaten AutoScout24 Listing-API-Zugangsdaten ein, prüfe die Verbindung und wähle danach
              die passende customerId für dieses Autohaus aus.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Nicht den Händler-Portal-Login verwenden</AlertTitle>
            <AlertDescription>
              Der normale AutoScout24 Händler-Login mit E-Mail-Code funktioniert hier nicht. Du brauchst separate
              Data-Provider/API-Zugangsdaten für die Listing Creation API. Falls du die noch nicht hast, musst du sie
              bei AutoScout24 anfragen.
            </AlertDescription>
          </Alert>

          {autoscoutConnection?.lastError ? (
            <Alert variant="destructive">
              <AlertTitle>Letzter Fehler</AlertTitle>
              <AlertDescription>{autoscoutConnection.lastError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="as24-username">Data-Provider Benutzername</Label>
              <Input id="as24-username" value={username} onChange={(event) => setUsername(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="as24-password">API-Passwort</Label>
              <Input
                id="as24-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={autoscoutConnection?.username ? "Für Änderungen neues Passwort eingeben" : ""}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => verifyMutation.mutate()}
              disabled={!username.trim() || !password.trim() || verifyMutation.isPending}
            >
              {verifyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verbindung prüfen
            </Button>
            <Button
              type="button"
              onClick={() => saveConnectionMutation.mutate()}
              disabled={!username.trim() || !password.trim() || !customerId || saveConnectionMutation.isPending}
            >
              {saveConnectionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verbindung speichern
            </Button>
          </div>

          <div className="space-y-2">
            <Label>customerId für dieses Autohaus</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Bitte erst Verbindung prüfen" />
              </SelectTrigger>
              <SelectContent>
                {(verifiedCustomers.length > 0 ? verifiedCustomers : []).map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.id}
                    {customer.sellId ? ` • Sell-ID ${customer.sellId}` : ""}
                  </SelectItem>
                ))}
                {verifiedCustomers.length === 0 && autoscoutConnection?.customerId ? (
                  <SelectItem value={autoscoutConnection.customerId}>{autoscoutConnection.customerId}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automatische Uploads</CardTitle>
          <CardDescription>
            Markierte Fahrzeuge können stündlich oder täglich automatisch neu synchronisiert werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium">Upload-Automatik aktiv</div>
              <div className="text-sm text-muted-foreground">Zeitzone: Europe/Berlin</div>
            </div>
            <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Rhythmus</Label>
              <Select value={scheduleFrequency} onValueChange={(value: "hourly" | "daily") => setScheduleFrequency(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Stündlich</SelectItem>
                  <SelectItem value="daily">Täglich</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stunde</Label>
              <Input type="number" min="0" max="23" value={scheduleHour} onChange={(event) => setScheduleHour(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Minute</Label>
              <Input type="number" min="0" max="59" value={scheduleMinute} onChange={(event) => setScheduleMinute(event.target.value)} />
            </div>
          </div>

          {autoscoutSchedule?.nextRunAt ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
              Nächster Lauf: {new Date(autoscoutSchedule.nextRunAt).toLocaleString("de-DE")}
            </div>
          ) : null}

          <Button onClick={() => saveScheduleMutation.mutate()} disabled={saveScheduleMutation.isPending}>
            {saveScheduleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Automatik speichern
          </Button>
        </CardContent>
      </Card>

      {autoscoutConnection?.status === "connected" ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Bereit für Uploads</AlertTitle>
          <AlertDescription>
            AutoScout24 ist verbunden. In Fahrzeugen kannst du jetzt AutoScout24 auswählen und bei Bedarf sofort hochladen.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
