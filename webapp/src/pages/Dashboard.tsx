import { useQuery } from "@tanstack/react-query";
import { Car, Users, Receipt, TrendingUp, Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

// Types
interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  color?: string;
  fuelType?: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  marginTaxed: boolean;
  status: "available" | "reserved" | "sold";
  createdAt: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  createdAt: string;
}

interface Sale {
  id: string;
  vehicleId: string;
  customerId: string;
  salePrice: number;
  taxRate: number;
  saleDate: string;
  notes?: string;
  vehicle: {
    brand: string;
    model: string;
    year: number;
    sellingPrice: number;
    taxRate: number;
    marginTaxed: boolean;
  };
  customer: {
    firstName: string;
    lastName: string;
    company?: string;
  };
  createdAt: string;
}

// Formatters
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("de-DE").format(new Date(dateString));

const formatDateLong = (dateString: string) =>
  new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateString));

// Stat card config
interface StatConfig {
  label: string;
  icon: typeof Car;
  gradient: string;
  iconBg: string;
}

const statConfigs: StatConfig[] = [
  {
    label: "Gesamte Fahrzeuge",
    icon: Car,
    gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
    iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  {
    label: "Verfugbare Fahrzeuge",
    icon: Car,
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Gesamte Kunden",
    icon: Users,
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    label: "Bestandswert",
    icon: TrendingUp,
    gradient: "from-violet-500/10 via-violet-500/5 to-transparent",
    iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
];

function StatCard({
  config,
  value,
  subtitle,
  isLoading,
  index,
}: {
  config: StatConfig;
  value: string | number;
  subtitle?: string;
  isLoading: boolean;
  index: number;
}) {
  const Icon = config.icon;

  return (
    <Card
      className="relative overflow-hidden border-border/50 animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
      style={{ animationDelay: `${index * 80}ms`, animationDuration: "400ms" }}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${config.gradient} pointer-events-none`}
      />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {config.label}
            </p>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">{value}</p>
            )}
            {subtitle ? (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.iconBg}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentVehiclesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function RecentSalesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="text-right space-y-1.5">
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

const statusLabels: Record<string, string> = {
  available: "Verfugbar",
  reserved: "Reserviert",
  sold: "Verkauft",
};

const statusVariants: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  reserved: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  sold: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
};

export default function Dashboard() {
  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.get<Vehicle[]>("/api/vehicles"),
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<Customer[]>("/api/customers"),
  });

  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => api.get<Sale[]>("/api/sales"),
  });

  const isLoading = vehiclesLoading || customersLoading || salesLoading;

  const totalVehicles = vehicles?.length ?? 0;
  const availableVehicles = vehicles?.filter((v) => v.status === "available").length ?? 0;
  const totalCustomers = customers?.length ?? 0;
  const totalSales = sales?.length ?? 0;
  const totalRevenue = sales?.reduce((sum, s) => sum + s.salePrice, 0) ?? 0;
  const bestandswert = vehicles?.filter(v => v.status === "available").reduce((sum, v) => sum + (v.marginTaxed ? v.sellingPrice : v.sellingPrice * (1 + v.taxRate / 100)), 0) ?? 0;

  const recentVehicles = vehicles
    ? [...vehicles]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5)
    : [];

  const recentSales = sales
    ? [...sales]
        .sort(
          (a, b) =>
            new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
        )
        .slice(0, 5)
    : [];

  const statValues = [
    { value: totalVehicles, subtitle: undefined },
    { value: availableVehicles, subtitle: undefined },
    { value: totalCustomers, subtitle: undefined },
    { value: formatCurrency(bestandswert), subtitle: `${availableVehicles} verfügbare Fahrzeuge` },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDateLong(new Date().toISOString())}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {statConfigs.map((config, i) => (
          <StatCard
            key={config.label}
            config={config}
            value={statValues[i].value}
            subtitle={statValues[i].subtitle}
            isLoading={isLoading}
            index={i}
          />
        ))}
      </div>

      {/* Recent sections */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Recent Vehicles */}
        <Card
          className="border-border/50 animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
          style={{ animationDelay: "350ms", animationDuration: "400ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">
              Neueste Fahrzeuge
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-xs text-muted-foreground"
            >
              <Link to="/vehicles">
                Alle anzeigen
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {vehiclesLoading ? (
              <RecentVehiclesSkeleton />
            ) : recentVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Car className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Noch keine Fahrzeuge vorhanden
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentVehicles.map((vehicle) => (
                  <Link
                    key={vehicle.id}
                    to={`/vehicles/${vehicle.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {vehicle.brand} {vehicle.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vehicle.year} &middot;{" "}
                        {formatCurrency(vehicle.sellingPrice)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] font-medium ${statusVariants[vehicle.status] ?? ""}`}
                    >
                      {statusLabels[vehicle.status] ?? vehicle.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card
          className="border-border/50 animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
          style={{ animationDelay: "400ms", animationDuration: "400ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">
              Neueste Verkaufe
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-xs text-muted-foreground"
            >
              <Link to="/sales">
                Alle anzeigen
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {salesLoading ? (
              <RecentSalesSkeleton />
            ) : recentSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Noch keine Verkaufe vorhanden
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between rounded-lg px-2 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {sale.vehicle.brand} {sale.vehicle.model} (
                        {sale.vehicle.year})
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {sale.customer.firstName} {sale.customer.lastName}
                        {sale.customer.company
                          ? ` - ${sale.customer.company}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(sale.salePrice)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(sale.saleDate)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
