import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Search, Plus, Car, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  type Vehicle,
  formatPrice,
  formatMileage,
  calculateGrossPrice,
  STATUS_CONFIG,
  getFileUrl,
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

export default function VehicleList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
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
            placeholder="Marke oder Modell suchen..."
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
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !vehicles || vehicles.length === 0 ? (
        <EmptyState search={search} statusFilter={statusFilter} />
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
              {vehicles.map((vehicle) => (
                <TableRow
                  key={vehicle.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        {vehicle.images?.[0] ? (
                          <img
                            src={getFileUrl(vehicle.images[0].url)}
                            alt={`${vehicle.brand} ${vehicle.model}`}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <Car className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {vehicle.brand} {vehicle.model}
                        </p>
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
                  <TableCell className="text-right">
                    <StatusBadge status={vehicle.status} />
                  </TableCell>
                </TableRow>
              ))}
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
}: {
  search: string;
  statusFilter: StatusFilter;
}) {
  const hasFilters = search.trim() || statusFilter !== "all";

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
