import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Search, Plus, Car, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-client";
import {
  type Vehicle,
  PRIVATE_VEHICLE_BADGE_CLASSNAME,
  formatPrice,
  formatMileage,
  calculateGrossPrice,
  STATUS_CONFIG,
  getFileUrl,
} from "@/lib/vehicles";
import { getAutoscoutTarget, getMarketplaceStatusLabel } from "@/lib/marketplaces";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StatusFilter = "all" | "available" | "reserved" | "sold";
type VisibilityFilter = "all" | "business" | "private";
type MarketplaceFilter = "all" | "autoscout" | "not_selected";

function getPrimaryImage(vehicle: Vehicle) {
  return vehicle.images?.find((image) => image.isPrimary) ?? vehicle.images?.[0];
}

export default function VehicleList() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const privateVehiclesEnabled = session?.entitlements?.private_vehicles === true;
  const marketplaceExportsEnabled = session?.entitlements?.marketplace_exports === true;
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [marketplaceFilter, setMarketplaceFilter] = useState<MarketplaceFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles", statusFilter, visibilityFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (privateVehiclesEnabled && visibilityFilter === "private") params.set("isPrivate", "true");
      if (privateVehiclesEnabled && visibilityFilter === "business") params.set("isPrivate", "false");
      if (search.trim()) params.set("search", search.trim());
      const qs = params.toString();
      return api.get<Vehicle[]>(`/api/vehicles${qs ? `?${qs}` : ""}`);
    },
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setSelectedIds([]);
    },
  });

  const filteredVehicles = useMemo(() => {
    const currentVehicles = vehicles ?? [];
    if (!marketplaceExportsEnabled || marketplaceFilter === "all") {
      return currentVehicles;
    }

    return currentVehicles.filter((vehicle) => {
      const autoscoutTarget = getAutoscoutTarget(vehicle);
      if (marketplaceFilter === "autoscout") {
        return autoscoutTarget?.enabled === true;
      }
      return autoscoutTarget?.enabled !== true;
    });
  }, [vehicles, marketplaceExportsEnabled, marketplaceFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fahrzeuge</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihren Fahrzeugbestand
          </p>
        </div>
        <Button asChild className="bg-amber-600 hover:bg-amber-700">
          <Link to="/vehicles/new">
            <Plus className="mr-2 h-4 w-4" />
            Neues Fahrzeug
          </Link>
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Interne Nummer, Marke oder Modell suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="available">Verfügbar</TabsTrigger>
            <TabsTrigger value="reserved">Reserviert</TabsTrigger>
            <TabsTrigger value="sold">Verkauft</TabsTrigger>
          </TabsList>
        </Tabs>
        {privateVehiclesEnabled ? (
          <Tabs
            value={visibilityFilter}
            onValueChange={(v) => setVisibilityFilter(v as VisibilityFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">Alle Fahrzeuge</TabsTrigger>
              <TabsTrigger value="business">Bestand</TabsTrigger>
              <TabsTrigger value="private">Privat</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}
        {marketplaceExportsEnabled ? (
          <Tabs
            value={marketplaceFilter}
            onValueChange={(value) => setMarketplaceFilter(value as MarketplaceFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">Alle Plattformen</TabsTrigger>
              <TabsTrigger value="autoscout">AutoScout24</TabsTrigger>
              <TabsTrigger value="not_selected">Nicht markiert</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      {marketplaceExportsEnabled ? (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={selectedIds.length === 0 || bulkTargetMutation.isPending}
            onClick={() => bulkTargetMutation.mutate(true)}
          >
            Für AutoScout24 markieren
          </Button>
          <Button
            variant="outline"
            disabled={selectedIds.length === 0 || bulkTargetMutation.isPending}
            onClick={() => bulkTargetMutation.mutate(false)}
          >
            AutoScout24 entfernen
          </Button>
        </div>
      ) : null}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !filteredVehicles || filteredVehicles.length === 0 ? (
        <EmptyState
          search={search}
          statusFilter={statusFilter}
          visibilityFilter={visibilityFilter}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {marketplaceExportsEnabled ? <TableHead className="w-12">
                  <Checkbox
                    checked={filteredVehicles.length > 0 && selectedIds.length === filteredVehicles.length}
                    onCheckedChange={(checked) =>
                      setSelectedIds(checked ? filteredVehicles.map((vehicle) => vehicle.id) : [])
                    }
                  />
                </TableHead> : null}
                <TableHead>Fahrzeug</TableHead>
                <TableHead className="hidden sm:table-cell">Baujahr</TableHead>
                <TableHead className="hidden md:table-cell">
                  Kilometerstand
                </TableHead>
                <TableHead className="text-right">Preis (Brutto)</TableHead>
                {marketplaceExportsEnabled ? <TableHead>AutoScout24</TableHead> : null}
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.map((vehicle) => {
                const primaryImage = getPrimaryImage(vehicle);
                const autoscoutTarget = getAutoscoutTarget(vehicle);

                return (
                  <TableRow
                    key={vehicle.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                  >
                    {marketplaceExportsEnabled ? (
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(vehicle.id)}
                          onCheckedChange={(checked) =>
                            setSelectedIds((current) =>
                              checked
                                ? [...new Set([...current, vehicle.id])]
                                : current.filter((item) => item !== vehicle.id)
                            )
                          }
                        />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/60">
                          {primaryImage ? (
                            <img
                              src={getFileUrl(primaryImage.url)}
                              alt={`${vehicle.brand} ${vehicle.model}`}
                              className="h-full w-full object-contain p-1"
                            />
                          ) : (
                            <Car className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {vehicle.brand} {vehicle.model}
                            </p>
                            {privateVehiclesEnabled && vehicle.isPrivate ? (
                              <Badge
                                variant="outline"
                                className={`h-5 px-2 text-[11px] ${PRIVATE_VEHICLE_BADGE_CLASSNAME}`}
                              >
                                Privat
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {vehicle.vehicleNumber}
                          </p>
                          <p className="text-xs text-muted-foreground sm:hidden">
                            {vehicle.firstRegistration
                              ? new Date(vehicle.firstRegistration).getFullYear()
                              : vehicle.year ?? "--"} &middot;{" "}
                            {formatMileage(vehicle.mileage)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {vehicle.firstRegistration
                        ? new Date(vehicle.firstRegistration).getFullYear()
                        : vehicle.year ?? "--"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatMileage(vehicle.mileage)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(
                        calculateGrossPrice(
                          vehicle.sellingPrice,
                          vehicle.taxRate,
                          vehicle.marginTaxed
                        )
                      )}
                    </TableCell>
                    {marketplaceExportsEnabled ? (
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={autoscoutTarget?.enabled ? "default" : "outline"}>
                            {autoscoutTarget?.enabled ? "Markiert" : "Nicht gewählt"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {getMarketplaceStatusLabel(autoscoutTarget?.remoteStatus)}
                          </span>
                        </div>
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right">
                      <StatusBadge status={vehicle.status} />
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

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.available;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function EmptyState({
  search,
  statusFilter,
  visibilityFilter,
}: {
  search: string;
  statusFilter: StatusFilter;
  visibilityFilter: VisibilityFilter;
}) {
  const hasFilters =
    search.trim() || statusFilter !== "all" || visibilityFilter !== "all";

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 py-20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Car className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-1 text-lg font-semibold">
        {hasFilters ? "Keine Ergebnisse" : "Noch keine Fahrzeuge"}
      </h3>
      <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
        {hasFilters
          ? "Versuchen Sie andere Suchbegriffe oder Filter."
          : "Legen Sie Ihr erstes Fahrzeug an, um den Bestand zu verwalten."}
      </p>
      {!hasFilters ? (
        <Button asChild className="bg-amber-600 hover:bg-amber-700">
          <Link to="/vehicles/new">
            <Plus className="mr-2 h-4 w-4" />
            Neues Fahrzeug
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
