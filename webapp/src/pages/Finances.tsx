import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Package,
  BarChart2,
  Star,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/vehicles";
import type { FinancesData } from "../../../backend/src/types";

// ─── Date helpers ─────────────────────────────────────────────

function getDateRange(preset: string): { from: string; to: string } | null {
  const now = new Date();
  if (preset === "week") {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    return {
      from: from.toISOString().split("T")[0],
      to: now.toISOString().split("T")[0],
    };
  }
  if (preset === "month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0],
      to: now.toISOString().split("T")[0],
    };
  }
  if (preset === "year") {
    return {
      from: new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0],
      to: now.toISOString().split("T")[0],
    };
  }
  return null; // "all" = no filter
}

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// ─── Types ────────────────────────────────────────────────────

type Preset = "all" | "week" | "month" | "year";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "week", label: "Diese Woche" },
  { key: "month", label: "Diesen Monat" },
  { key: "year", label: "Dieses Jahr" },
  { key: "all", label: "Gesamt" },
];

// ─── KPI Card ─────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  gradient?: string;
  index: number;
}

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  subtext,
  gradient = "from-transparent to-transparent",
  index,
}: KpiCardProps) {
  return (
    <Card
      className="relative overflow-hidden border-border/50 animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
      style={{ animationDelay: `${index * 60}ms`, animationDuration: "350ms" }}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`}
      />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <div className="text-2xl font-bold tracking-tight leading-none">
              {value}
            </div>
            {subtext ? (
              <div className="text-xs text-muted-foreground leading-snug">
                {subtext}
              </div>
            ) : null}
          </div>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
          >
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function Finances() {
  const [preset, setPreset] = useState<Preset>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Determine effective date range
  const customRangeActive = customFrom !== "" && customTo !== "";
  const dateRange = customRangeActive
    ? { from: customFrom, to: customTo }
    : getDateRange(preset);

  // Build query string
  const queryParams = new URLSearchParams();
  if (dateRange) {
    queryParams.set("from", dateRange.from);
    queryParams.set("to", dateRange.to);
  }
  const queryString = queryParams.toString();

  const {
    data: finances,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["finances", queryString],
    queryFn: () =>
      api.get<FinancesData>(`/api/finances${queryString ? `?${queryString}` : ""}`),
  });

  // Computed KPI values
  const avgMargin =
    finances && finances.vehiclesSold > 0
      ? finances.totalProfit / finances.vehiclesSold
      : null;

  // ── Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error state
  if (isError || !finances) {
    return (
      <div className="flex items-center justify-center min-h-[400px] gap-3 text-muted-foreground">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <span>Finanzdaten konnten nicht geladen werden.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      {/* ── Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finanzen</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Umsatz- und Gewinnauswertung
        </p>
      </div>

      {/* ── Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Preset pills */}
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setPreset(key);
                setCustomFrom("");
                setCustomTo("");
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border",
                !customRangeActive && preset === key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-5 w-px bg-border/60" />

        {/* Custom date range */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground text-xs font-medium">Von</span>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className={cn(
              "h-8 rounded-lg border px-2.5 text-sm bg-background text-foreground transition-colors",
              customRangeActive
                ? "border-foreground ring-1 ring-foreground/20"
                : "border-border focus:border-foreground/60"
            )}
          />
          <span className="text-muted-foreground text-xs font-medium">Bis</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className={cn(
              "h-8 rounded-lg border px-2.5 text-sm bg-background text-foreground transition-colors",
              customRangeActive
                ? "border-foreground ring-1 ring-foreground/20"
                : "border-border focus:border-foreground/60"
            )}
          />
          {customRangeActive ? (
            <button
              onClick={() => {
                setCustomFrom("");
                setCustomTo("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
            >
              Zurücksetzen
            </button>
          ) : null}
        </div>
      </div>

      {/* ── KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Eingekauft */}
        <KpiCard
          index={0}
          icon={ShoppingCart}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
          gradient="from-blue-500/5 via-transparent to-transparent"
          label="Eingekauft"
          value={
            <span>
              {finances.vehiclesBought}{" "}
              <span className="text-base font-normal text-muted-foreground">
                Fzg.
              </span>
            </span>
          }
          subtext={
            <span>
              {formatPrice(finances.totalPurchaseCost)}
              {finances.totalAdditionalCosts > 0 ? (
                <span className="text-amber-500 ml-1">
                  + {formatPrice(finances.totalAdditionalCosts)} Zusatzkosten
                </span>
              ) : null}
            </span>
          }
        />

        {/* 2. Verkauft */}
        <KpiCard
          index={1}
          icon={TrendingUp}
          iconBg="bg-violet-500/10"
          iconColor="text-violet-500"
          gradient="from-violet-500/5 via-transparent to-transparent"
          label="Verkauft"
          value={
            <span>
              {finances.vehiclesSold}{" "}
              <span className="text-base font-normal text-muted-foreground">
                Fzg.
              </span>
            </span>
          }
          subtext={formatPrice(finances.totalRevenue)}
        />

        {/* 3. Gewinn */}
        <KpiCard
          index={2}
          icon={DollarSign}
          iconBg={
            finances.totalProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
          }
          iconColor={
            finances.totalProfit >= 0 ? "text-emerald-500" : "text-red-500"
          }
          gradient={
            finances.totalProfit >= 0
              ? "from-emerald-500/5 via-transparent to-transparent"
              : "from-red-500/5 via-transparent to-transparent"
          }
          label="Gewinn"
          value={
            <span
              className={
                finances.totalProfit >= 0
                  ? "text-emerald-500"
                  : "text-red-500"
              }
            >
              {formatPrice(finances.totalProfit)}
            </span>
          }
          subtext={
            <span>
              <span className="text-emerald-500">
                {finances.profitableSales} Gewinne
              </span>
              {" / "}
              <span className="text-red-500">
                {finances.lossSales} Verluste
              </span>
            </span>
          }
        />

        {/* 4. Lagerbestand */}
        <KpiCard
          index={3}
          icon={Package}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
          gradient="from-amber-500/5 via-transparent to-transparent"
          label="Lagerbestand"
          value={
            <span>
              {finances.vehiclesInStock}{" "}
              <span className="text-base font-normal text-muted-foreground">
                Fzg.
              </span>
            </span>
          }
          subtext={
            <span>
              {formatPrice(finances.stockValue)}{" "}
              <span className="text-muted-foreground/60">(aktuell)</span>
            </span>
          }
        />

        {/* 5. Ø Marge */}
        <KpiCard
          index={4}
          icon={BarChart2}
          iconBg="bg-sky-500/10"
          iconColor="text-sky-500"
          gradient="from-sky-500/5 via-transparent to-transparent"
          label="Ø Marge"
          value={
            avgMargin !== null ? (
              <span
                className={
                  avgMargin >= 0 ? "text-emerald-500" : "text-red-500"
                }
              >
                {formatPrice(avgMargin)}
              </span>
            ) : (
              <span className="text-muted-foreground">--</span>
            )
          }
          subtext="Durchschnitt pro Verkauf"
        />

        {/* 6. Bestes Geschäft */}
        <KpiCard
          index={5}
          icon={Star}
          iconBg="bg-rose-500/10"
          iconColor="text-rose-500"
          gradient="from-rose-500/5 via-transparent to-transparent"
          label="Bestes Geschäft"
          value={
            finances.bestSale ? (
              <span className="text-xl">
                {finances.bestSale.brand} {finances.bestSale.model}
              </span>
            ) : (
              <span className="text-muted-foreground">--</span>
            )
          }
          subtext={
            finances.bestSale ? (
              <span className="text-emerald-500 font-medium">
                + {formatPrice(finances.bestSale.profit)}
              </span>
            ) : undefined
          }
        />
      </div>

      {/* ── Sales table */}
      <div
        className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
        style={{ animationDelay: "380ms", animationDuration: "350ms" }}
      >
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">
              Verkäufe im Zeitraum
            </CardTitle>
            <Badge
              variant="secondary"
              className="text-xs font-medium tabular-nums"
            >
              {finances.sales.length}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {finances.sales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
                <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Keine Verkäufe in diesem Zeitraum
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Datum
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Fahrzeug
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Kunde
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Einkauf
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Zusatzkosten
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Verkauf
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Marge
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {finances.sales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap tabular-nums">
                          {formatDate(sale.saleDate)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-medium">
                            {sale.brand} {sale.model}
                          </span>
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            #{sale.vehicleNumber}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                          {sale.customerName}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums whitespace-nowrap">
                          {formatPrice(sale.purchasePrice)}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums whitespace-nowrap">
                          {sale.additionalCosts > 0 ? (
                            <span className="text-amber-500 font-medium">
                              {formatPrice(sale.additionalCosts)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums whitespace-nowrap">
                          {formatPrice(sale.salePrice)}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums whitespace-nowrap">
                          <span
                            className={cn(
                              "font-bold",
                              sale.profit >= 0
                                ? "text-emerald-500"
                                : "text-red-500"
                            )}
                          >
                            {sale.profit >= 0 ? "+" : ""}
                            {formatPrice(sale.profit)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
