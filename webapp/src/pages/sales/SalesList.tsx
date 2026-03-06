import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Receipt,
  Car,
  Calendar,
  FileText,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

// Types
interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  sellingPrice: number;
  taxRate: number;
  marginTaxed: boolean;
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

interface SaleCreatePayload {
  vehicleId: string;
  customerId: string;
  salePrice: number;
  taxRate: number;
  saleDate?: string;
  notes?: string;
}

// Formatters
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("de-DE").format(new Date(dateString));

function calculateGross(
  salePrice: number,
  taxRate: number,
  marginTaxed: boolean
): number {
  if (marginTaxed) {
    return salePrice;
  }
  return salePrice * (1 + taxRate / 100);
}

function calculateNetto(
  salePrice: number,
  taxRate: number,
  marginTaxed: boolean
): number {
  if (marginTaxed) {
    return salePrice / (1 + taxRate / 100);
  }
  return salePrice;
}

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
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0]
  );
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

  const availableVehicles = vehicles?.filter((v) => v.status === "available") ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: SaleCreatePayload) =>
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
    onError: () => {
      toast({
        title: "Fehler",
        description: "Der Verkauf konnte nicht erstellt werden.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setVehicleId("");
    setCustomerId("");
    setSalePrice("");
    setTaxRate("");
    setSaleDate(new Date().toISOString().split("T")[0]);
    setNotes("");
  };

  const handleVehicleChange = (id: string) => {
    setVehicleId(id);
    const vehicle = availableVehicles.find((v) => v.id === id);
    if (vehicle) {
      setSalePrice(String(vehicle.sellingPrice));
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
      taxRate: parseFloat(taxRate) || 19,
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Neuen Verkauf anlegen</DialogTitle>
          <DialogDescription>
            Wahlen Sie ein Fahrzeug und einen Kunden fur den Verkauf aus.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vehicle select */}
          <div className="space-y-2">
            <Label htmlFor="vehicle">Fahrzeug</Label>
            <Select value={vehicleId} onValueChange={handleVehicleChange}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Fahrzeug wahlen..." />
              </SelectTrigger>
              <SelectContent>
                {availableVehicles.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    Keine verfugbaren Fahrzeuge
                  </div>
                ) : (
                  availableVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.year})
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
                <SelectValue placeholder="Kunde wahlen..." />
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salePrice">Verkaufspreis</Label>
              <Input
                id="salePrice"
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
              />
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

function DeleteSaleButton({ saleId }: { saleId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/sales/${saleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({
        title: "Verkauf geloscht",
        description:
          "Der Verkauf wurde geloscht und das Fahrzeug ist wieder verfugbar.",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Der Verkauf konnte nicht geloscht werden.",
        variant: "destructive",
      });
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Loschen</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Verkauf loschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Dieser Vorgang kann nicht ruckgangig gemacht werden. Das Fahrzeug
            wird wieder als verfugbar markiert.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Loschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function SalesList() {
  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => api.get<Sale[]>("/api/sales"),
  });

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
          <h1 className="text-3xl font-bold tracking-tight">Verkaufe</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Fahrzeugverkaufe
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
      ) : sortedSales.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Receipt className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              Keine Verkaufe vorhanden
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Erstellen Sie Ihren ersten Verkauf, indem Sie oben auf "Neuer
              Verkauf" klicken.
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
                    <TableHead className="w-[60px]">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSales.map((sale) => {
                    const netto = calculateNetto(
                      sale.salePrice,
                      sale.taxRate,
                      sale.vehicle.marginTaxed
                    );
                    const gross = calculateGross(
                      sale.salePrice,
                      sale.taxRate,
                      sale.vehicle.marginTaxed
                    );

                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">
                          {sale.vehicle.brand} {sale.vehicle.model}{" "}
                          {sale.vehicle.year}
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
                          {formatCurrency(netto)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(gross)}
                        </TableCell>
                        <TableCell>{formatDate(sale.saleDate)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                          {sale.notes ?? "-"}
                        </TableCell>
                        <TableCell>
                          <DeleteSaleButton saleId={sale.id} />
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
              const netto = calculateNetto(
                sale.salePrice,
                sale.taxRate,
                sale.vehicle.marginTaxed
              );
              const gross = calculateGross(
                sale.salePrice,
                sale.taxRate,
                sale.vehicle.marginTaxed
              );

              return (
                <Card key={sale.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 min-w-0">
                        <p className="font-medium truncate">
                          {sale.vehicle.brand} {sale.vehicle.model}{" "}
                          {sale.vehicle.year}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {sale.customer.firstName} {sale.customer.lastName}
                          {sale.customer.company
                            ? ` - ${sale.customer.company}`
                            : ""}
                        </p>
                      </div>
                      <DeleteSaleButton saleId={sale.id} />
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Netto: {formatCurrency(netto)}
                        </p>
                        <p className="text-lg font-bold tabular-nums">
                          {formatCurrency(gross)}
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
