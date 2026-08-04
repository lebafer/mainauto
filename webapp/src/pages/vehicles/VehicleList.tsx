import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  calculateVehicleStockDays,
  STATUS_CONFIG,
  getFileUrl,
  toDateInputValue,
} from "@/lib/vehicles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

function getPrimaryImage(vehicle: Vehicle) {
  return vehicle.images?.find((image) => image.isPrimary) ?? vehicle.images?.[0];
}

export default function VehicleList() {
  const { session } = useAuth();
  const privateVehiclesEnabled = session?.entitlements?.private_vehicles === true;
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");

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
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !vehicles || vehicles.length === 0 ? (
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
                <TableHead>Fahrzeug</TableHead>
                <TableHead className="hidden sm:table-cell">Baujahr</TableHead>
                <TableHead className="hidden md:table-cell">
                  Kilometerstand
                </TableHead>
                <TableHead className="text-right">Preis (Brutto)</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => {
                const primaryImage = getPrimaryImage(vehicle);
                const stockDays = calculateVehicleStockDays(vehicle);

                return (
                  <TableRow
                    key={vehicle.id}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                    role="link"
                    tabIndex={0}
                    aria-label={`${vehicle.brand} ${vehicle.model} öffnen`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/vehicles/${vehicle.id}`);
                      }
                    }}
                  >
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
                              ? toDateInputValue(vehicle.firstRegistration).slice(0, 4)
                              : vehicle.year ?? "Baujahr unbekannt"} &middot;{" "}
                            {formatMileage(vehicle.mileage)} · {stockDays} Standtage
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {vehicle.firstRegistration
                        ? toDateInputValue(vehicle.firstRegistration).slice(0, 4)
                        : vehicle.year ?? "Unbekannt"}
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
