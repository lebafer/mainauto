import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Rocket, Trash2, UploadCloud } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { getAutoscoutTarget, getMarketplaceStatusLabel, type MarketplaceVehicleRow } from "@/lib/marketplaces";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const QUERY_KEY = ["marketplaces", "autoscout24", "vehicles"];

export default function MarketplaceUploads() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const canManage =
    session?.dealerRole === "dealer_owner" || session?.dealerRole === "dealer_admin";
  const featureEnabled = session?.entitlements?.marketplace_exports === true;

  const vehiclesQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<MarketplaceVehicleRow[]>("/api/marketplaces/autoscout24/vehicles"),
    enabled: canManage && featureEnabled,
  });

  const bulkTargetMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.post("/api/marketplaces/vehicles/bulk-targets", {
        vehicleIds: selectedIds,
        target: {
          platform: "autoscout24",
          enabled,
        },
      }),
    onSuccess: async (_, enabled) => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        title: enabled ? "AutoScout24 markiert" : "AutoScout24 entfernt",
      });
    },
    onError: (error) => {
      toast({
        title: "Aktualisierung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Die Auswahl konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    },
  });

  const bulkActionMutation = useMutation({
    mutationFn: (action: "sync" | "activate" | "deactivate" | "delete") =>
      action === "sync"
        ? api.post("/api/marketplaces/sync", {
            platform: "autoscout24",
            vehicleIds: selectedIds,
          })
        : Promise.all(
            selectedIds.map((vehicleId) => api.post(`/api/marketplaces/autoscout24/vehicles/${vehicleId}/${action}`))
          ),
    onSuccess: async (_, action) => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        title:
          action === "sync"
            ? "Upload gestartet"
            : action === "activate"
              ? "Listings aktiviert"
              : action === "deactivate"
                ? "Listings deaktiviert"
                : "Listings gelöscht",
      });
    },
    onError: (error) => {
      toast({
        title: "Aktion fehlgeschlagen",
        description: error instanceof Error ? error.message : "Die Aktion konnte nicht ausgeführt werden.",
        variant: "destructive",
      });
    },
  });

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const rows = vehiclesQuery.data ?? [];

  function toggleSelection(vehicleId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, vehicleId])] : current.filter((item) => item !== vehicleId)
    );
  }

  if (!canManage) {
    return <div className="text-sm text-muted-foreground">Kein Zugriff auf diese Seite.</div>;
  }

  if (!featureEnabled) {
    return (
      <Alert>
        <AlertTitle>Pro-Feature</AlertTitle>
        <AlertDescription>
          Die Upload-Zentrale für Vertriebskanäle ist im Pro-Tarif enthalten.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Upload-Zentrale</CardTitle>
            <CardDescription>
              Wähle Fahrzeuge aus, markiere AutoScout24 als Ziel und starte Uploads oder Live-Aktionen gesammelt.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link to="/settings/marketplaces">Zur Verbindung</Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => bulkTargetMutation.mutate(true)}
            disabled={selectedIds.length === 0 || bulkTargetMutation.isPending}
          >
            AutoScout24 markieren
          </Button>
          <Button
            variant="outline"
            onClick={() => bulkTargetMutation.mutate(false)}
            disabled={selectedIds.length === 0 || bulkTargetMutation.isPending}
          >
            AutoScout24 abwählen
          </Button>
          <Button
            onClick={() => bulkActionMutation.mutate("sync")}
            disabled={selectedIds.length === 0 || bulkActionMutation.isPending}
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload starten
          </Button>
          <Button
            variant="outline"
            onClick={() => bulkActionMutation.mutate("activate")}
            disabled={selectedIds.length === 0 || bulkActionMutation.isPending}
          >
            <Rocket className="mr-2 h-4 w-4" />
            Live schalten
          </Button>
          <Button
            variant="outline"
            onClick={() => bulkActionMutation.mutate("deactivate")}
            disabled={selectedIds.length === 0 || bulkActionMutation.isPending}
          >
            Inaktiv setzen
          </Button>
          <Button
            variant="destructive"
            onClick={() => bulkActionMutation.mutate("delete")}
            disabled={selectedIds.length === 0 || bulkActionMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remote löschen
          </Button>
        </CardContent>
      </Card>

      {vehiclesQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={rows.length > 0 && selectedIds.length === rows.length}
                    onCheckedChange={(checked) =>
                      setSelectedIds(checked ? rows.map((row) => row.id) : [])
                    }
                  />
                </TableHead>
                <TableHead>Fahrzeug</TableHead>
                <TableHead>Ziel</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fehler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((vehicle) => {
                const target = getAutoscoutTarget(vehicle);
                return (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSet.has(vehicle.id)}
                        onCheckedChange={(checked) => toggleSelection(vehicle.id, checked === true)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Link className="font-medium hover:underline" to={`/vehicles/${vehicle.id}`}>
                          {vehicle.brand} {vehicle.model}
                        </Link>
                        <div className="text-xs text-muted-foreground">{vehicle.vehicleNumber}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={target?.enabled ? "default" : "outline"}>
                        {target?.enabled ? "AutoScout24" : "Nicht gewählt"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {vehicle.readiness.ready ? (
                        <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                          Bereit
                        </Badge>
                      ) : (
                        <div className="max-w-[320px] text-xs text-muted-foreground">
                          {vehicle.readiness.issues.join(", ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">{getMarketplaceStatusLabel(target?.remoteStatus)}</Badge>
                        {target?.remoteUrl ? (
                          <a
                            href={target.remoteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs text-primary hover:underline"
                          >
                            Listing öffnen
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[320px] text-xs text-muted-foreground">
                        {target?.lastError || "Kein Fehler"}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
