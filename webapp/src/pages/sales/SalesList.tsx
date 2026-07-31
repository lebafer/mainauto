import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Receipt,
  Car,
  Calendar,
  FileText,
  Loader2,
  RefreshCw,
  Download,
  Ban,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-client";
import { ApiError } from "@/lib/api";
import {
  calculateGrossPrice,
  getResolvedSaleAmounts,
  parseTaxRateInput,
} from "@/lib/vehicles";
import { toLocalDateInputValue } from "@/lib/dates";
import type {
  Invoice,
  SaleAccountingSnapshotResolve,
  SaleCreate,
} from "../../../../backend/src/types";

// Types
interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year?: number | null;
  sellingPrice: number;
  taxRate: number;
  marginTaxed: boolean;
  isPrivate: boolean;
  status: "available" | "reserved" | "sold";
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
}

interface Sale {
  id: string;
  vehicleId: string;
  customerId: string;
  salePrice: number;
  accountingStatus: "verified" | "legacy_snapshot" | "legacy_ambiguous";
  grossSalePrice: number | null;
  netSalePrice: number | null;
  taxAmount: number | null;
  taxRate: number;
  status: "completed" | "reversed";
  saleDate: string;
  notes?: string;
  vehicle: {
    brand: string;
    model: string;
    year?: number | null;
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

function dateInputInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

// Formatters
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("de-DE").format(new Date(dateString));

function SalesTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

function CreateSaleDialog() {
  const { session } = useAuth();
  const privateVehiclesEnabled = session?.entitlements?.private_vehicles === true;
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [saleDate, setSaleDate] = useState(toLocalDateInputValue);
  const [notes, setNotes] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.get<Vehicle[]>("/api/vehicles"),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<Customer[]>("/api/customers"),
  });

  const availableVehicles =
    vehicles?.filter((v) => v.status === "available" && (!privateVehiclesEnabled || !v.isPrivate)) ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: SaleCreate) =>
      api.post<Sale>("/api/sales", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({
        title: "Verkauf erstellt",
        description: "Der Verkauf wurde erfolgreich angelegt.",
      });
      resetForm();
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Verkauf konnte nicht erstellt werden",
        description: error instanceof ApiError ? error.message : "Bitte prüfe die Eingaben und versuche es erneut.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setVehicleId("");
    setCustomerId("");
    setSalePrice("");
    setTaxRate("");
    setSaleDate(toLocalDateInputValue());
    setNotes("");
  };

  const handleVehicleChange = (id: string) => {
    setVehicleId(id);
    const vehicle = availableVehicles.find((v) => v.id === id);
    if (vehicle) {
      setSalePrice(
        calculateGrossPrice(
          vehicle.sellingPrice,
          vehicle.taxRate,
          vehicle.marginTaxed
        ).toFixed(2)
      );
      setTaxRate(String(vehicle.taxRate));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !customerId || !salePrice) return;

    createMutation.mutate({
      vehicleId,
      customerId,
      salePrice: parseFloat(salePrice),
      priceMode: "gross",
      taxRate: parseTaxRateInput(taxRate),
      saleDate: saleDate || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Verkauf
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Neuen Verkauf anlegen</DialogTitle>
          <DialogDescription>
            Wähle ein Fahrzeug und einen Kunden für den Verkauf aus. Der Verkaufspreis wird als Endpreis gespeichert.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vehicle select */}
          <div className="space-y-2">
            <Label htmlFor="vehicle">Fahrzeug</Label>
            <Select value={vehicleId} onValueChange={handleVehicleChange}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Fahrzeug wählen..." />
              </SelectTrigger>
              <SelectContent>
                {availableVehicles.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    Keine verfügbaren Fahrzeuge
                  </div>
                ) : (
                  availableVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.year ? `Baujahr ${v.year}` : "Baujahr unbekannt"})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Customer select */}
          <div className="space-y-2">
            <Label htmlFor="customer">Kunde</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="customer">
                <SelectValue placeholder="Kunde wählen..." />
              </SelectTrigger>
              <SelectContent>
                {customers?.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    Keine Kunden vorhanden
                  </div>
                ) : (
                  customers?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                      {c.company ? ` (${c.company})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Price and tax */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="salePrice">Endpreis (Brutto)</Label>
              <Input
                id="salePrice"
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                required
              />
              <p className="text-xs text-muted-foreground">
                Betrag, den der Kunde tatsächlich bezahlt.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxRate">Steuersatz (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="19"
                inputMode="decimal"
                required
              />
            </div>
          </div>

          {/* Sale date */}
          <div className="space-y-2">
            <Label htmlFor="saleDate">Verkaufsdatum</Label>
            <Input
              id="saleDate"
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionale Anmerkungen zum Verkauf..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={
                !vehicleId ||
                !customerId ||
                !salePrice ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                "Verkauf anlegen"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDialog({
  sale,
  invoice,
}: {
  sale: Sale;
  invoice?: Invoice;
}) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState(dateInputInDays(14));
  const [deliveryDate, setDeliveryDate] = useState(sale.saleDate.slice(0, 10));
  const [deliveryDateConfirmed, setDeliveryDateConfirmed] = useState(false);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [activeInvoice, setActiveInvoice] = useState<Invoice | undefined>(invoice);
  const vehicleLabel = `${sale.vehicle.brand} ${sale.vehicle.model}`;

  useEffect(() => {
    setActiveInvoice(invoice);
  }, [invoice]);

  const refreshInvoices = (nextInvoice?: Invoice) => {
    if (nextInvoice) setActiveInvoice(nextInvoice);
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Invoice>("/api/documents/invoices", {
        saleId: sale.id,
        deliveryDate,
        dueDate: dueDate || undefined,
        notes: invoiceNotes.trim() || undefined,
      }),
    onSuccess: (createdInvoice) => {
      refreshInvoices(createdInvoice);
      toast({
        title: "Rechnung erstellt",
        description: `Rechnung ${createdInvoice.invoiceNumber} wurde revisionssicher gespeichert.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Rechnung konnte nicht erstellt werden",
        description: error instanceof Error ? error.message : "Bitte versuche es erneut.",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      api.post<Invoice>(`/api/documents/invoices/${activeInvoice?.id}/cancel`, {
        reason: cancelReason.trim(),
      }),
    onSuccess: (canceledInvoice) => {
      refreshInvoices(canceledInvoice);
      setCancelReason("");
      toast({
        title: "Rechnung storniert",
        description: `${canceledInvoice.invoiceNumber} bleibt zur Nachvollziehbarkeit erhalten.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Rechnung konnte nicht storniert werden",
        description: error instanceof Error ? error.message : "Bitte versuche es erneut.",
        variant: "destructive",
      });
    },
  });

  async function downloadInvoice() {
    if (!activeInvoice) return;
    try {
      const response = await api.raw(`/api/documents/invoices/${activeInvoice.id}/pdf`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `Rechnung_${activeInvoice.invoiceNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast({
        title: "Download fehlgeschlagen",
        description: error instanceof Error ? error.message : "Die Rechnung konnte nicht geladen werden.",
        variant: "destructive",
      });
    }
  }

  const canCancel =
    activeInvoice?.status === "issued" &&
    session?.dealerRole === "dealer_owner";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-9" disabled={sale.status === "reversed" && !activeInvoice}>
          <Receipt className="mr-2 h-4 w-4" />
          {activeInvoice?.invoiceNumber ?? "Rechnung"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {activeInvoice ? `Rechnung ${activeInvoice.invoiceNumber}` : "Rechnung erstellen"}
          </DialogTitle>
          <DialogDescription>
            {activeInvoice
              ? `Verkauf: ${vehicleLabel}. Die Rechnung bleibt auch nach einer Stornierung nachvollziehbar.`
              : `Erstelle die Rechnung für den Verkauf von ${vehicleLabel}. Die Rechnungsnummer wird automatisch vergeben.`}
          </DialogDescription>
        </DialogHeader>

        {activeInvoice ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={activeInvoice.status === "issued" ? "default" : "secondary"} className="mt-1">
                  {activeInvoice.status === "issued" ? "Ausgestellt" : "Storniert"}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Endbetrag</p>
                <p className="mt-1 font-semibold tabular-nums">{formatCurrency(activeInvoice.grossAmount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ausgestellt</p>
                <p>{formatDate(activeInvoice.issuedAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Fällig</p>
                <p>{activeInvoice.dueAt ? formatDate(activeInvoice.dueAt) : "Sofort"}</p>
              </div>
            </div>
            {activeInvoice.status === "canceled" ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium">
                  Diese Rechnung wurde storniert und darf nicht mehr als Zahlungsbeleg verwendet werden.
                </p>
                {activeInvoice.canceledAt ? (
                  <p className="mt-1 text-muted-foreground">
                    Storniert am {formatDate(activeInvoice.canceledAt)}
                    {activeInvoice.cancelReason ? `: ${activeInvoice.cancelReason}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-between">
              {canCancel ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-destructive hover:text-destructive">
                      <Ban className="mr-2 h-4 w-4" />
                      Stornieren
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Rechnung wirklich stornieren?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {activeInvoice.invoiceNumber} wird als storniert markiert. Die Rechnung und ihre Nummer bleiben
                        aus rechtlichen Gründen erhalten. Dieser Vorgang lässt sich nicht rückgängig machen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor={`invoice-cancel-reason-${sale.id}`}>
                        Stornierungsgrund
                      </Label>
                      <Textarea
                        id={`invoice-cancel-reason-${sale.id}`}
                        value={cancelReason}
                        onChange={(event) => setCancelReason(event.target.value)}
                        placeholder="Mindestens 3 Zeichen, z. B. Kaufvertrag rückabgewickelt"
                        minLength={3}
                        maxLength={1000}
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={cancelMutation.isPending || cancelReason.trim().length < 3}
                        onClick={() => cancelMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {cancelMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Rechnung stornieren
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : <span />}
              <Button onClick={() => void downloadInvoice()}>
                <Download className="mr-2 h-4 w-4" />
                PDF herunterladen
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`invoice-delivery-${sale.id}`}>Liefer-/Leistungsdatum</Label>
              <Input
                id={`invoice-delivery-${sale.id}`}
                type="date"
                value={deliveryDate}
                onChange={(event) => {
                  setDeliveryDate(event.target.value);
                  setDeliveryDateConfirmed(false);
                }}
              />
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={deliveryDateConfirmed}
                  onCheckedChange={(checked) => setDeliveryDateConfirmed(checked === true)}
                  className="mt-0.5"
                />
                Ich habe das tatsächliche Liefer-/Leistungsdatum anhand der Unterlagen geprüft.
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`invoice-due-${sale.id}`}>Fälligkeitsdatum</Label>
              <Input
                id={`invoice-due-${sale.id}`}
                type="date"
                min={dateInputInDays(0)}
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`invoice-notes-${sale.id}`}>Rechnungshinweis (optional)</Label>
              <Textarea
                id={`invoice-notes-${sale.id}`}
                value={invoiceNotes}
                onChange={(event) => setInvoiceNotes(event.target.value)}
                placeholder="z. B. Zahlungsziel oder Referenz"
                maxLength={10_000}
              />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rechnungsbetrag</span>
                <span className="font-semibold tabular-nums">
                  {sale.grossSalePrice !== null
                    ? formatCurrency(sale.grossSalePrice)
                    : "Preisprüfung erforderlich"}
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button
                type="button"
                disabled={
                  createMutation.isPending ||
                  sale.accountingStatus === "legacy_ambiguous" ||
                  !deliveryDate ||
                  !deliveryDateConfirmed
                }
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Rechnung verbindlich erstellen
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccountingSnapshotDialog({ sale }: { sale: Sale }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [historicTaxMode, setHistoricTaxMode] =
    useState<SaleAccountingSnapshotResolve["historicTaxMode"]>("regular");
  const [historicPriceMode, setHistoricPriceMode] =
    useState<SaleAccountingSnapshotResolve["historicPriceMode"]>("gross");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [manualCosts, setManualCosts] = useState("");
  const [exportCosts, setExportCosts] = useState("");

  const optionalMoney = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const resolveMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/sales/${sale.id}/accounting-snapshot`, {
        historicTaxMode,
        historicPriceMode: historicTaxMode === "regular" ? historicPriceMode : undefined,
        purchasePrice: optionalMoney(purchasePrice),
        manualCosts: optionalMoney(manualCosts),
        exportCosts: optionalMoney(exportCosts),
      } satisfies SaleAccountingSnapshotResolve),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["finances"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
      ]);
      setOpen(false);
      toast({
        title: "Historische Steuer- und Preisbasis bestätigt",
        description: "Umsatz, Steuer und Marge werden jetzt aus dem geprüften, unveränderlichen Snapshot berechnet.",
      });
    },
    onError: (error) => {
      toast({
        title: "Preisbasis konnte nicht gespeichert werden",
        description: error instanceof Error ? error.message : "Bitte prüfe die Angaben.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-700">
          Preis prüfen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historischen Verkauf einordnen</DialogTitle>
          <DialogDescription>
            Für diesen Altverkauf sind Steuerart und Preisbasis historisch nicht sicher gespeichert.
            Prüfe den ursprünglichen Vertrag oder die Rechnung zu {formatCurrency(sale.salePrice)}.
            Die bestätigte Einordnung wird revisionssicher protokolliert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Historische Steuerart</Label>
            <Select
              value={historicTaxMode}
              onValueChange={(value: "regular" | "margin") => setHistoricTaxMode(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regelbesteuerung</SelectItem>
                <SelectItem value="margin">Differenzbesteuerung nach § 25a UStG</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {historicTaxMode === "regular" ? (
            <div className="space-y-2">
            <Label>Der historische Verkaufspreis war</Label>
            <Select
              value={historicPriceMode}
              onValueChange={(value: "gross" | "net") => setHistoricPriceMode(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gross">Brutto / Endpreis</SelectItem>
                <SelectItem value="net">Netto zuzüglich Umsatzsteuer</SelectItem>
              </SelectContent>
            </Select>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
              Bei Differenzbesteuerung wird der historische Betrag als Endpreis behandelt; die interne
              Umsatzsteuer wird ausschließlich aus einer positiven Handelsspanne berechnet.
            </div>
          )}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Die folgenden Werte sind optional. Leer lassen übernimmt den bei der Migration
            eingefrorenen historischen Stand.
          </div>
          {[
            ["purchase-price", "Einkaufspreis", purchasePrice, setPurchasePrice],
            ["manual-costs", "Zusatzkosten", manualCosts, setManualCosts],
            ["export-costs", "Exportkosten", exportCosts, setExportCosts],
          ].map(([key, label, value, setter]) => (
            <div className="space-y-2" key={key as string}>
              <Label htmlFor={`${key}-${sale.id}`}>{label as string} (optional)</Label>
              <Input
                id={`${key}-${sale.id}`}
                type="number"
                min="0"
                max="20000000"
                step="0.01"
                inputMode="decimal"
                value={value as string}
                onChange={(event) => (setter as (next: string) => void)(event.target.value)}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={resolveMutation.isPending}
            onClick={() => resolveMutation.mutate()}
          >
            {resolveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Geprüfte Einordnung speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReverseSaleButton({
  saleId,
  vehicleLabel,
}: {
  saleId: string;
  vehicleLabel: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuth();

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/sales/${saleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Verkauf storniert",
        description:
          "Der Verkauf wurde storniert. Das Fahrzeug ist wieder verfügbar; die Historie bleibt erhalten.",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Der Verkauf konnte nicht storniert werden.",
        variant: "destructive",
      });
    },
  });

  if (!["dealer_owner", "dealer_admin"].includes(session?.dealerRole ?? "")) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label={`Verkauf von ${vehicleLabel} stornieren`}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Verkauf stornieren</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Verkauf wirklich stornieren?</AlertDialogTitle>
          <AlertDialogDescription>
            Der Verkauf von {vehicleLabel} wird storniert. Das Fahrzeug wird wieder als
            verfügbar markiert und die Kundenzuordnung entfernt. Verkauf und Rechnungsnummern
            bleiben zur Nachvollziehbarkeit erhalten.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Verkauf stornieren
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function SalesList() {
  const { session } = useAuth();
  const canManageInvoices = ["dealer_owner", "dealer_admin"].includes(
    session?.dealerRole ?? ""
  );
  const { data: sales, isLoading, isError, refetch } = useQuery({
    queryKey: ["sales"],
    queryFn: () => api.get<Sale[]>("/api/sales"),
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get<Invoice[]>("/api/documents/invoices"),
    enabled: canManageInvoices,
  });
  const invoiceBySaleId = new Map(invoices.map((invoice) => [invoice.saleId, invoice]));

  const sortedSales = sales
    ? [...sales].sort(
        (a, b) =>
          new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verkäufe</h1>
          <p className="text-muted-foreground">
            Verwalte Fahrzeugverkäufe, Rechnungen und Verkaufsbelege.
          </p>
        </div>
        <CreateSaleDialog />
      </div>

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <SalesTableSkeleton />
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <Receipt className="h-10 w-10 text-destructive/70" />
            <div>
              <h3 className="font-semibold">Verkäufe konnten nicht geladen werden</h3>
              <p className="mt-1 text-sm text-muted-foreground">Bitte prüfe die Verbindung und versuche es erneut.</p>
            </div>
            <Button variant="outline" onClick={() => void refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      ) : sortedSales.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Receipt className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              Keine Verkäufe vorhanden
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Erstelle den ersten Verkauf über „Neuer Verkauf“.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="flex items-center gap-1.5">
                        <Car className="h-3.5 w-3.5" />
                        Fahrzeug
                      </div>
                    </TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead className="text-right">Brutto</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Datum
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Notizen
                      </div>
                    </TableHead>
                    {canManageInvoices ? <TableHead>Rechnung</TableHead> : null}
                    <TableHead className="w-[60px]">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSales.map((sale) => {
                    const resolvedAmounts = getResolvedSaleAmounts(sale);
                    const accountingReady = resolvedAmounts !== null;

                    return (
                      <TableRow key={sale.id} className={sale.status === "reversed" ? "opacity-60" : undefined}>
                        <TableCell className="font-medium">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{sale.vehicle.brand} {sale.vehicle.model}{" "}
                            {sale.vehicle.year ?? "Baujahr unbekannt"}</span>
                            {sale.status === "reversed" ? <Badge variant="secondary">Storniert</Badge> : null}
                            {!accountingReady ? <Badge variant="outline" className="border-amber-500/50 text-amber-600">Preisprüfung nötig</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {sale.customer.firstName} {sale.customer.lastName}
                          </div>
                          {sale.customer.company ? (
                            <div className="text-xs text-muted-foreground">
                              {sale.customer.company}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {resolvedAmounts ? formatCurrency(resolvedAmounts.net) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {resolvedAmounts ? formatCurrency(resolvedAmounts.gross) : "—"}
                        </TableCell>
                        <TableCell>{formatDate(sale.saleDate)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                          {sale.notes ?? "-"}
                        </TableCell>
                        {canManageInvoices ? <TableCell>
                          {sale.accountingStatus === "legacy_ambiguous" ? (
                            <AccountingSnapshotDialog sale={sale} />
                          ) : sale.status === "reversed" && !invoiceBySaleId.get(sale.id) ? (
                            <Badge variant="secondary">Kein Beleg</Badge>
                          ) : (
                            <InvoiceDialog sale={sale} invoice={invoiceBySaleId.get(sale.id)} />
                          )}
                        </TableCell> : null}
                        <TableCell>
                          {sale.status === "completed" ? (
                            <ReverseSaleButton
                              saleId={sale.id}
                              vehicleLabel={`${sale.vehicle.brand} ${sale.vehicle.model} (${sale.vehicle.year ?? "Baujahr unbekannt"})`}
                            />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {sortedSales.map((sale) => {
              const resolvedAmounts = getResolvedSaleAmounts(sale);

              return (
                <Card key={sale.id} className={sale.status === "reversed" ? "opacity-70" : undefined}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 min-w-0">
                        <p className="font-medium truncate">
                          {sale.vehicle.brand} {sale.vehicle.model}{" "}
                          {sale.vehicle.year ?? "Baujahr unbekannt"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {sale.customer.firstName} {sale.customer.lastName}
                          {sale.customer.company
                            ? ` - ${sale.customer.company}`
                            : ""}
                        </p>
                      </div>
                      {sale.status === "completed" ? (
                        <ReverseSaleButton
                          saleId={sale.id}
                          vehicleLabel={`${sale.vehicle.brand} ${sale.vehicle.model} (${sale.vehicle.year ?? "Baujahr unbekannt"})`}
                        />
                      ) : <Badge variant="secondary">Storniert</Badge>}
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Netto: {resolvedAmounts ? formatCurrency(resolvedAmounts.net) : "—"}
                        </p>
                        <p className="text-lg font-bold tabular-nums">
                          {resolvedAmounts ? formatCurrency(resolvedAmounts.gross) : "Preisprüfung nötig"}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(sale.saleDate)}
                      </p>
                    </div>
                    {sale.notes ? (
                      <p className="mt-2 text-xs text-muted-foreground border-t pt-2 truncate">
                        {sale.notes}
                      </p>
                    ) : null}
                    {canManageInvoices ? <div className="mt-3 border-t pt-3">
                      {sale.accountingStatus === "legacy_ambiguous" ? (
                        <AccountingSnapshotDialog sale={sale} />
                      ) : sale.status === "reversed" && !invoiceBySaleId.get(sale.id) ? (
                        <Badge variant="secondary">Kein Beleg</Badge>
                      ) : (
                        <InvoiceDialog sale={sale} invoice={invoiceBySaleId.get(sale.id)} />
                      )}
                    </div> : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
