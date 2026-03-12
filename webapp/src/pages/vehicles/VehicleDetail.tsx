import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  Car,
  Gauge,
  Palette,
  Fuel,
  Settings2,
  Zap,
  Hash,
  FileText,
  ShoppingCart,
  UserPlus,
  PlusCircle,
  Receipt,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  type Vehicle,
  type VehicleCostBreakdownItem,
  formatPrice,
  formatMileage,
  calculateGrossPrice,
  calculateTaxAmount,
  parseFeatures,
  STATUS_CONFIG,
  getFileUrl,
  getVehicleAdditionalCostsTotal,
  getVehicleCostBreakdown,
  getVehicleExportCostsTotal,
  getVehicleManualCostsTotal,
  getVehicleMargin,
} from "@/lib/vehicles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { VehicleImagesTab } from "@/components/vehicles/VehicleImagesTab";
import { VehicleDocumentsTab } from "@/components/vehicles/VehicleDocumentsTab";
import { AddCostDialog } from "@/components/vehicles/AddCostDialog";
import { WorkLogTab } from "@/components/vehicles/WorkLogTab";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// ─── Shared Customer type ────────────────────────────────────────

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  idDocumentType?: string | null;
  idDocumentNumber?: string | null;
  idDocumentValidUntil?: string | null;
}

// ─── Supplier type (from /api/suppliers-db) ──────────────────────

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  supplierType: string | null;
}

// ─── Helper: save HTML as document attached to vehicle ───────────

async function saveHtmlDocument(
  vehicleId: string,
  html: string,
  filename: string,
  docName: string
) {
  const blob = new Blob([html], { type: "text/html" });
  const htmlFile = new File([blob], filename, { type: "text/html" });
  const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
  const formData = new FormData();
  formData.append("file", htmlFile);
  formData.append("name", docName);
  await fetch(`${baseUrl}/api/vehicles/${vehicleId}/documents`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
}

// ─── Helper: open print window ───────────────────────────────────

function openPrintWindow(html: string) {
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(
      html + '<script>window.onload = function() { window.print(); }</s' + 'cript>'
    );
    win.document.close();
  }
}

// ─── Main component ──────────────────────────────────────────────

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const defaultTab = (location.state as { defaultTab?: string } | null)?.defaultTab ?? "images";
  const [sellOpen, setSellOpen] = useState(false);
  const [addCostOpen, setAddCostOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractCustomerId, setContractCustomerId] = useState("");
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseSellerSource, setPurchaseSellerSource] = useState<"customer" | "supplier" | "manual">("customer");
  const [purchaseSellerId, setPurchaseSellerId] = useState("");
  const [purchaseManualFirstName, setPurchaseManualFirstName] = useState("");
  const [purchaseManualLastName, setPurchaseManualLastName] = useState("");
  const [purchaseManualCompany, setPurchaseManualCompany] = useState("");
  const [purchaseManualAddress, setPurchaseManualAddress] = useState("");
  const [purchaseManualZip, setPurchaseManualZip] = useState("");
  const [purchaseManualCity, setPurchaseManualCity] = useState("");
  const [purchaseManualCountry, setPurchaseManualCountry] = useState("");
  const [purchaseManualPhone, setPurchaseManualPhone] = useState("");
  const [purchaseManualEmail, setPurchaseManualEmail] = useState("");
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [gbDialogOpen, setGbDialogOpen] = useState(false);
  const [gbCustomerId, setGbCustomerId] = useState("");
  const [gbDateOfReceipt, setGbDateOfReceipt] = useState("");
  const [gbPassportType, setGbPassportType] = useState("");
  const [gbPassportNumber, setGbPassportNumber] = useState("");
  const [gbPassportValidUntil, setGbPassportValidUntil] = useState("");
  const [gbLoading, setGbLoading] = useState(false);

  // Vermittlungsvertrag dialog state
  const [vermDialogOpen, setVermDialogOpen] = useState(false);
  const [vermBuyerSource, setVermBuyerSource] = useState<"customer" | "supplier">("customer");
  const [vermBuyerId, setVermBuyerId] = useState("");
  const [vermSellerSource, setVermSellerSource] = useState<"customer" | "supplier" | "manual">("customer");
  const [vermSellerId, setVermSellerId] = useState("");
  const [vermManualFirstName, setVermManualFirstName] = useState("");
  const [vermManualLastName, setVermManualLastName] = useState("");
  const [vermManualCompany, setVermManualCompany] = useState("");
  const [vermManualAddress, setVermManualAddress] = useState("");
  const [vermManualZip, setVermManualZip] = useState("");
  const [vermManualCity, setVermManualCity] = useState("");
  const [vermManualCountry, setVermManualCountry] = useState("");
  const [vermManualPhone, setVermManualPhone] = useState("");
  const [vermManualEmail, setVermManualEmail] = useState("");
  const [vermLoading, setVermLoading] = useState(false);

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => api.get<Vehicle>(`/api/vehicles/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/vehicles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Fahrzeug gelöscht");
      navigate("/vehicles");
    },
    onError: () => {
      toast.error("Fehler beim Löschen");
    },
  });

  const generateDocMutation = useMutation({
    mutationFn: async ({ type, customerId }: { type: string; customerId?: string }) => {
      if (type === "contract") {
        // Generate PDF directly from backend
        const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
        const res = await fetch(`${baseUrl}/api/documents/generate-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type, vehicleId: id, ...(customerId ? { customerId } : {}) }),
        });
        if (!res.ok) throw new Error("PDF-Erstellung fehlgeschlagen");
        const blob = await res.blob();
        return { blob, type };
      } else {
        const data = await api.post<{ html: string; type: string; vehicleNumber: string }>("/api/documents/generate", {
          type,
          vehicleId: id,
          ...(customerId ? { customerId } : {}),
        });
        return { html: data.html, vehicleNumber: data.vehicleNumber, type: data.type };
      }
    },
    onSuccess: async (data, variables) => {
      const date = new Date().toISOString().split("T")[0];

      if (variables.type === "contract" && "blob" in data && data.blob) {
        const vn = vehicle?.vehicleNumber ?? new Date().toISOString().split("T")[0];
        const filename = `Kaufvertrag_${vn}.pdf`;
        const docName = `Kaufvertrag ${vn}`;
        // Trigger PDF download
        const url = URL.createObjectURL(data.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        // Also save the HTML version for the documents tab
        try {
          // Re-fetch HTML to save
          const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
          const htmlRes = await fetch(`${baseUrl}/api/documents/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ type: "contract", vehicleId: id, customerId: variables.customerId }),
          });
          if (htmlRes.ok) {
            const htmlData = await htmlRes.json();
            await saveHtmlDocument(id!, htmlData.data.html, `${filename.replace(".pdf", ".html")}`, docName);
          }
        } catch { /* ignore save errors */ }
        queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
        toast.success("Kaufvertrag als PDF gespeichert");
      } else if ("html" in data && data.html) {
        let filename = "Dokument.html";
        let docName = "Dokument";
        if (variables.type === "offer") {
          filename = `Angebot-${date}.html`;
          docName = `Angebot ${date}`;
        } else if (variables.type === "price-tag") {
          filename = `Preisschild-${date}.html`;
          docName = `Preisschild ${date}`;
        }
        openPrintWindow(data.html);
        try {
          await saveHtmlDocument(id!, data.html, filename, docName);
          queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
          toast.success("Dokument gespeichert");
        } catch {
          toast.error("Dokument konnte nicht gespeichert werden");
        }
      }
    },
    onError: () => {
      toast.error("Fehler beim Erstellen des Dokuments");
    },
  });

  // Customers for contract dialog
  const { data: contractCustomers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<Customer[]>("/api/customers"),
    enabled: contractDialogOpen || purchaseDialogOpen || gbDialogOpen || vermDialogOpen,
  });

  // Suppliers for purchase / vermittlung dialogs
  const { data: vermSuppliers } = useQuery({
    queryKey: ["suppliers-db"],
    queryFn: () => api.get<Supplier[]>("/api/suppliers-db"),
    enabled: purchaseDialogOpen || vermDialogOpen,
  });

  const selectedGbCustomer = contractCustomers?.find((c) => c.id === gbCustomerId);

  useEffect(() => {
    if (!selectedGbCustomer) return;
    setGbPassportType(selectedGbCustomer.idDocumentType ?? "");
    setGbPassportNumber(selectedGbCustomer.idDocumentNumber ?? "");
    setGbPassportValidUntil(
      selectedGbCustomer.idDocumentValidUntil
        ? new Date(selectedGbCustomer.idDocumentValidUntil).toISOString().split("T")[0]
        : ""
    );
  }, [selectedGbCustomer]);

  async function handlePurchaseContractDownload() {
    if (!id || !vehicle) return;

    setPurchaseLoading(true);
    const vn = vehicle.vehicleNumber ?? id;
    const filename = `Ankaufvertrag_${vn}.pdf`;
    const docName = `Ankaufvertrag ${vn}`;
    const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
    const payload = {
      vehicleId: id,
      sellerSource: purchaseSellerSource,
      ...(purchaseSellerSource === "manual"
        ? {
            manualSeller: {
              firstName: purchaseManualFirstName,
              lastName: purchaseManualLastName,
              company: purchaseManualCompany || undefined,
              address: purchaseManualAddress || undefined,
              zip: purchaseManualZip || undefined,
              city: purchaseManualCity || undefined,
              country: purchaseManualCountry || undefined,
              phone: purchaseManualPhone || undefined,
              email: purchaseManualEmail || undefined,
            },
          }
        : {
            sellerId: purchaseSellerId,
          }),
    };

    try {
      const pdfRes = await fetch(`${baseUrl}/api/documents/generate-purchase-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!pdfRes.ok) throw new Error("PDF-Erstellung fehlgeschlagen");

      const blob = await pdfRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      try {
        const htmlRes = await fetch(`${baseUrl}/api/documents/generate-purchase-html`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (htmlRes.ok) {
          const { data } = await htmlRes.json();
          await saveHtmlDocument(id, data.html, filename.replace(".pdf", ".html"), docName);
        }
      } catch {
        // Ignore HTML save errors after successful PDF creation.
      }

      queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
      toast.success("Ankaufvertrag als PDF gespeichert");
      setPurchaseDialogOpen(false);
    } catch {
      toast.error("Fehler beim Erstellen des Ankaufvertrags");
    } finally {
      setPurchaseLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Fahrzeug nicht gefunden</p>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/vehicles">Zurück zur Übersicht</Link>
        </Button>
      </div>
    );
  }

  const grossPrice = calculateGrossPrice(
    vehicle.sellingPrice,
    vehicle.taxRate,
    vehicle.marginTaxed
  );
  const taxAmount = calculateTaxAmount(
    vehicle.sellingPrice,
    vehicle.taxRate,
    vehicle.marginTaxed
  );
  const features = parseFeatures(vehicle.features);
  const statusConfig = STATUS_CONFIG[vehicle.status] ?? STATUS_CONFIG.available;
  const manualAdditionalCosts = getVehicleManualCostsTotal(vehicle);
  const exportAdditionalCosts = getVehicleExportCostsTotal(vehicle);
  const totalAdditionalCosts = getVehicleAdditionalCostsTotal(vehicle);
  const totalInvested = vehicle.purchasePrice + totalAdditionalCosts;
  const margin = getVehicleMargin(vehicle);
  const costBreakdown = getVehicleCostBreakdown(vehicle);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1">
            <Link to="/vehicles">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {vehicle.brand} {vehicle.model}
              </h1>
              <Badge variant="outline" className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {vehicle.firstRegistration
                ? new Date(vehicle.firstRegistration).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
                : vehicle.year
                  ? vehicle.year
                  : null}
              {" "}&middot; {formatMileage(vehicle.mileage)}
              {vehicle.vin ? ` · ${vehicle.vin}` : ""}
              {vehicle.vehicleNumber ? (
                <span className="ml-2 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  {vehicle.vehicleNumber}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:shrink-0">
          {vehicle.status !== "sold" && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setSellOpen(true)}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Verkaufen
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link to={`/vehicles/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Bearbeiten
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={generateDocMutation.isPending}
              >
                {generateDocMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Dokument erstellen
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => generateDocMutation.mutate({ type: "offer" })}
              >
                Angebot
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => generateDocMutation.mutate({ type: "price-tag" })}
              >
                Preisschild
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setPurchaseSellerSource("customer");
                  setPurchaseSellerId("");
                  setPurchaseManualFirstName("");
                  setPurchaseManualLastName("");
                  setPurchaseManualCompany("");
                  setPurchaseManualAddress("");
                  setPurchaseManualZip("");
                  setPurchaseManualCity("");
                  setPurchaseManualCountry("");
                  setPurchaseManualPhone("");
                  setPurchaseManualEmail("");
                  setPurchaseDialogOpen(true);
                }}
              >
                Ankaufvertrag
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setContractCustomerId("");
                  setContractDialogOpen(true);
                }}
              >
                Kaufvertrag
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setGbCustomerId(vehicle.customerId ?? "");
                  setGbDateOfReceipt("");
                  setGbPassportType("");
                  setGbPassportNumber("");
                  setGbDialogOpen(true);
                }}
              >
                Gelangensbestätigung
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setVermBuyerSource("customer");
                  setVermBuyerId("");
                  setVermSellerSource("customer");
                  setVermSellerId("");
                  setVermManualFirstName("");
                  setVermManualLastName("");
                  setVermManualCompany("");
                  setVermManualAddress("");
                  setVermManualZip("");
                  setVermManualCity("");
                  setVermManualCountry("");
                  setVermManualPhone("");
                  setVermManualEmail("");
                  setVermDialogOpen(true);
                }}
              >
                Vermittlungsvertrag
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Fahrzeug löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{vehicle.brand} {vehicle.model}" wird unwiderruflich gelöscht.
                  Alle zugehörigen Bilder und Dokumente werden ebenfalls entfernt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Endgültig löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Sell dialog */}
      <SellDialog
        open={sellOpen}
        onOpenChange={setSellOpen}
        vehicle={vehicle}
        queryClient={queryClient}
      />

      {/* Add Cost dialog */}
      <AddCostDialog
        vehicleId={vehicle.id}
        open={addCostOpen}
        onOpenChange={setAddCostOpen}
      />

      {/* Ankaufvertrag dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ankaufvertrag erstellen</DialogTitle>
            <DialogDescription>
              Wählen Sie den Verkäufer aus oder geben Sie ihn manuell ein.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <Label>Verkäufer</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={purchaseSellerSource === "customer" ? "default" : "outline"}
                  onClick={() => {
                    setPurchaseSellerSource("customer");
                    setPurchaseSellerId("");
                  }}
                >
                  Kunde
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={purchaseSellerSource === "supplier" ? "default" : "outline"}
                  onClick={() => {
                    setPurchaseSellerSource("supplier");
                    setPurchaseSellerId("");
                  }}
                >
                  Lieferant
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={purchaseSellerSource === "manual" ? "default" : "outline"}
                  onClick={() => {
                    setPurchaseSellerSource("manual");
                    setPurchaseSellerId("");
                  }}
                >
                  Manuell eingeben
                </Button>
              </div>

              {purchaseSellerSource === "customer" ? (
                <Select value={purchaseSellerId} onValueChange={setPurchaseSellerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kunden auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contractCustomers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                        {c.company ? ` – ${c.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : purchaseSellerSource === "supplier" ? (
                <Select value={purchaseSellerId} onValueChange={setPurchaseSellerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Lieferanten auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vermSuppliers?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.contactPerson ? ` – ${s.contactPerson}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Vorname *</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Max"
                        value={purchaseManualFirstName}
                        onChange={(e) => setPurchaseManualFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nachname *</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Mustermann"
                        value={purchaseManualLastName}
                        onChange={(e) => setPurchaseManualLastName(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Firma (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Musterfirma GmbH"
                        value={purchaseManualCompany}
                        onChange={(e) => setPurchaseManualCompany(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Adresse (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Musterstraße 1"
                        value={purchaseManualAddress}
                        onChange={(e) => setPurchaseManualAddress(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">PLZ (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="12345"
                        value={purchaseManualZip}
                        onChange={(e) => setPurchaseManualZip(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Stadt (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Berlin"
                        value={purchaseManualCity}
                        onChange={(e) => setPurchaseManualCity(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Land (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Deutschland"
                        value={purchaseManualCountry}
                        onChange={(e) => setPurchaseManualCountry(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefon (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="+49 ..."
                        value={purchaseManualPhone}
                        onChange={(e) => setPurchaseManualPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">E-Mail (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="max@example.com"
                        value={purchaseManualEmail}
                        onChange={(e) => setPurchaseManualEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={
                purchaseLoading ||
                (purchaseSellerSource === "manual"
                  ? (!purchaseManualFirstName || !purchaseManualLastName)
                  : !purchaseSellerId)
              }
              onClick={handlePurchaseContractDownload}
            >
              {purchaseLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              PDF herunterladen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kaufvertrag customer dialog */}
      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Kaufvertrag erstellen</DialogTitle>
            <DialogDescription>
              Wählen Sie einen Kunden für den Kaufvertrag.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label>Kunde</Label>
            <Select value={contractCustomerId} onValueChange={setContractCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Kunden auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {contractCustomers?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                    {c.company ? ` – ${c.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setContractDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={!contractCustomerId || generateDocMutation.isPending}
              onClick={() => {
                setContractDialogOpen(false);
                generateDocMutation.mutate({
                  type: "contract",
                  customerId: contractCustomerId,
                });
              }}
            >
              {generateDocMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Generieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gelangensbestätigung dialog */}
      <Dialog open={gbDialogOpen} onOpenChange={setGbDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gelangensbestätigung erstellen</DialogTitle>
            <DialogDescription>
              Angaben für die Gelangensbestätigung. Alle Felder sind optional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Kunde</Label>
              <Select value={gbCustomerId} onValueChange={setGbCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kunden auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {contractCustomers?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                      {c.company ? ` – ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date of receipt / Datum des Empfangs</Label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={gbDateOfReceipt}
                onChange={(e) => setGbDateOfReceipt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Passport type / Art des Ausweisdokuments</Label>
              <input
                type="text"
                placeholder="z.B. Reisepass"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
                value={gbPassportType}
                onChange={(e) => setGbPassportType(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Passport Number / Ausweisnummer</Label>
              <input
                type="text"
                placeholder="z.B. C01X00T47"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
                value={gbPassportNumber}
                onChange={(e) => setGbPassportNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valid until / Gültig bis</Label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={gbPassportValidUntil}
                onChange={(e) => setGbPassportValidUntil(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGbDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={!gbCustomerId || gbLoading}
              onClick={async () => {
                if (!gbCustomerId) return;
                setGbLoading(true);
                try {
                  const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
                  const res = await fetch(`${baseUrl}/api/documents/generate-gelangensbestaetigung`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      vehicleId: id,
                      customerId: gbCustomerId,
                      dateOfReceipt: gbDateOfReceipt,
                      passportType: gbPassportType,
                      passportNumber: gbPassportNumber,
                      passportValidUntil: gbPassportValidUntil,
                    }),
                  });
                  if (!res.ok) throw new Error("Fehler");
                  const blob = await res.blob();
                  const vn = vehicle?.vehicleNumber ?? id;
                  const filename = `Gelangensbestaetigung_${vn}.pdf`;
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  // Save HTML copy for documents tab
                  try {
                    const htmlRes = await fetch(`${baseUrl}/api/documents/generate-gelangensbestaetigung-html`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        vehicleId: id,
                        customerId: gbCustomerId,
                        dateOfReceipt: gbDateOfReceipt,
                        passportType: gbPassportType,
                        passportNumber: gbPassportNumber,
                        passportValidUntil: gbPassportValidUntil,
                      }),
                    });
                    if (htmlRes.ok) {
                      const { data } = await htmlRes.json();
                      await saveHtmlDocument(id!, data.html, filename.replace(".pdf", ".html"), `Gelangensbestätigung ${vn}`);
                    }
                  } catch { /* ignore */ }
                  queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
                  toast.success("Gelangensbestätigung erstellt");
                  setGbDialogOpen(false);
                } catch {
                  toast.error("Fehler beim Erstellen der Gelangensbestätigung");
                } finally {
                  setGbLoading(false);
                }
              }}
            >
              {gbLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              PDF herunterladen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vermittlungsvertrag dialog */}
      <Dialog open={vermDialogOpen} onOpenChange={setVermDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vermittlungsvertrag erstellen</DialogTitle>
            <DialogDescription>
              Wählen Sie Käufer und Verkäufer für den Vermittlungsvertrag.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Käufer */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Käufer</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={vermBuyerSource === "customer" ? "default" : "outline"}
                  onClick={() => { setVermBuyerSource("customer"); setVermBuyerId(""); }}
                >
                  Kunde
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={vermBuyerSource === "supplier" ? "default" : "outline"}
                  onClick={() => { setVermBuyerSource("supplier"); setVermBuyerId(""); }}
                >
                  Lieferant
                </Button>
              </div>
              {vermBuyerSource === "customer" ? (
                <Select value={vermBuyerId} onValueChange={setVermBuyerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kunden auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contractCustomers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                        {c.company ? ` – ${c.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={vermBuyerId} onValueChange={setVermBuyerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Lieferanten auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vermSuppliers?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.contactPerson ? ` – ${s.contactPerson}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Verkäufer */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Verkäufer</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={vermSellerSource === "customer" ? "default" : "outline"}
                  onClick={() => { setVermSellerSource("customer"); setVermSellerId(""); }}
                >
                  Kunde
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={vermSellerSource === "supplier" ? "default" : "outline"}
                  onClick={() => { setVermSellerSource("supplier"); setVermSellerId(""); }}
                >
                  Lieferant
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={vermSellerSource === "manual" ? "default" : "outline"}
                  onClick={() => { setVermSellerSource("manual"); setVermSellerId(""); }}
                >
                  Manuell eingeben
                </Button>
              </div>

              {vermSellerSource === "customer" ? (
                <Select value={vermSellerId} onValueChange={setVermSellerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kunden auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contractCustomers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                        {c.company ? ` – ${c.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : vermSellerSource === "supplier" ? (
                <Select value={vermSellerId} onValueChange={setVermSellerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Lieferanten auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vermSuppliers?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.contactPerson ? ` – ${s.contactPerson}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Vorname *</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Max"
                        value={vermManualFirstName}
                        onChange={(e) => setVermManualFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nachname *</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Mustermann"
                        value={vermManualLastName}
                        onChange={(e) => setVermManualLastName(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Firma (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Musterfirma GmbH"
                        value={vermManualCompany}
                        onChange={(e) => setVermManualCompany(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Adresse (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Musterstraße 1"
                        value={vermManualAddress}
                        onChange={(e) => setVermManualAddress(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">PLZ (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="12345"
                        value={vermManualZip}
                        onChange={(e) => setVermManualZip(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Stadt (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Berlin"
                        value={vermManualCity}
                        onChange={(e) => setVermManualCity(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Land (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Deutschland"
                        value={vermManualCountry}
                        onChange={(e) => setVermManualCountry(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefon (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="+49 ..."
                        value={vermManualPhone}
                        onChange={(e) => setVermManualPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">E-Mail (optional)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="max@example.com"
                        value={vermManualEmail}
                        onChange={(e) => setVermManualEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVermDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={
                vermLoading ||
                !vermBuyerId ||
                (vermSellerSource !== "manual" && !vermSellerId) ||
                (vermSellerSource === "manual" && (!vermManualFirstName || !vermManualLastName))
              }
              onClick={async () => {
                setVermLoading(true);
                const vn = vehicle?.vehicleNumber ?? id;
                const basePayload = {
                  vehicleId: id,
                  buyerId: vermBuyerId,
                  buyerType: vermBuyerSource,
                  ...(vermSellerSource !== "manual"
                    ? { sellerId: vermSellerId, sellerType: vermSellerSource }
                    : {
                        manualSeller: {
                          firstName: vermManualFirstName,
                          lastName: vermManualLastName,
                          company: vermManualCompany || undefined,
                          address: vermManualAddress || undefined,
                          zip: vermManualZip || undefined,
                          city: vermManualCity || undefined,
                          country: vermManualCountry || undefined,
                          phone: vermManualPhone || undefined,
                          email: vermManualEmail || undefined,
                        },
                      }),
                };
                try {
                  const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
                  // Download PDF
                  const pdfRes = await fetch(`${baseUrl}/api/documents/generate-vermittlung-pdf`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(basePayload),
                  });
                  if (!pdfRes.ok) throw new Error("PDF-Erstellung fehlgeschlagen");
                  const blob = await pdfRes.blob();
                  const filename = `Vermittlungsvertrag_${vn}.pdf`;
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  // Save HTML version
                  try {
                    const htmlRes = await fetch(`${baseUrl}/api/documents/generate-vermittlung-html`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify(basePayload),
                    });
                    if (htmlRes.ok) {
                      const { data } = await htmlRes.json();
                      const docName = `Vermittlungsvertrag ${vn}`;
                      await saveHtmlDocument(id!, data.html, filename.replace(".pdf", ".html"), docName);
                    }
                  } catch { /* ignore save errors */ }
                  queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
                  toast.success("Vermittlungsvertrag als PDF gespeichert");
                  setVermDialogOpen(false);
                } catch {
                  toast.error("Fehler beim Erstellen des Dokuments");
                } finally {
                  setVermLoading(false);
                }
              }}
            >
              {vermLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              PDF herunterladen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hero images */}
      <HeroImages images={vehicle.images} brand={vehicle.brand} model={vehicle.model} />

      {/* Info grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Key specs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Fahrzeugdaten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
              <InfoItem icon={Gauge} label="Kilometerstand" value={formatMileage(vehicle.mileage)} />
              {vehicle.firstRegistration ? (
                <InfoItem icon={Car} label="Erstzulassung" value={new Date(vehicle.firstRegistration).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })} />
              ) : null}
              <InfoItem icon={Palette} label="Farbe" value={vehicle.color || "--"} />
              <InfoItem icon={Fuel} label="Kraftstoff" value={vehicle.fuelType || "--"} />
              <InfoItem icon={Settings2} label="Getriebe" value={vehicle.transmission || "--"} />
              <InfoItem icon={Zap} label="Leistung" value={vehicle.power && vehicle.powerKw ? `${vehicle.power} PS / ${vehicle.powerKw} kW` : vehicle.power ? `${vehicle.power} PS` : vehicle.powerKw ? `${vehicle.powerKw} kW` : "--"} />
              <InfoItem icon={Hash} label="VIN" value={vehicle.vin || "--"} />
              {vehicle.supplier ? (
                <InfoItem icon={Car} label="Lieferant (Text)" value={vehicle.supplier} />
              ) : null}
              {vehicle.supplierRel ? (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Car className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lieferant</p>
                    <Link
                      to={`/suppliers/${vehicle.supplierRel.id}`}
                      className="text-sm font-medium text-amber-600 hover:underline"
                    >
                      {vehicle.supplierRel.name}
                    </Link>
                  </div>
                </div>
              ) : null}
              {vehicle.previousOwners != null ? (
                <InfoItem icon={Hash} label="Vorbesitzer" value={`${vehicle.previousOwners}`} />
              ) : null}
              {vehicle.huDue ? (
                <InfoItem icon={Settings2} label="Nächste HU fällig" value={new Date(vehicle.huDue).toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" })} />
              ) : null}
              {vehicle.serviceDueKm != null ? (
                <InfoItem icon={Gauge} label="Service fällig bei km" value={`${vehicle.serviceDueKm.toLocaleString("de-DE")} km`} />
              ) : null}
              {vehicle.serviceDueDate ? (
                <InfoItem icon={Settings2} label="Service fällig am" value={new Date(vehicle.serviceDueDate).toLocaleDateString("de-DE")} />
              ) : null}
              {vehicle.co2Emission != null ? (
                <InfoItem icon={Zap} label="CO₂-Ausstoß" value={`${vehicle.co2Emission} g/km`} />
              ) : null}
              {vehicle.displacement != null ? (
                <InfoItem icon={Settings2} label="Hubraum" value={`${vehicle.displacement} cm³`} />
              ) : null}
              {vehicle.chargingTime != null ? (
                <InfoItem icon={Zap} label="Ladezeit 20–80 %" value={`${vehicle.chargingTime} min`} />
              ) : null}
              {vehicle.connectorType ? (
                <InfoItem icon={Zap} label="Stecker-Typ" value={vehicle.connectorType} />
              ) : null}
              {vehicle.bodyType ? (
                <InfoItem icon={Car} label="Karosserieform" value={vehicle.bodyType} />
              ) : null}
              {vehicle.driveType ? (
                <InfoItem icon={Settings2} label="Antrieb" value={vehicle.driveType} />
              ) : null}
              {vehicle.emissionClass ? (
                <InfoItem icon={Zap} label="Schadstoffklasse" value={vehicle.emissionClass} />
              ) : null}
              {vehicle.doors != null ? (
                <InfoItem icon={Car} label="Türen" value={`${vehicle.doors}`} />
              ) : null}
              {vehicle.seats != null ? (
                <InfoItem icon={Car} label="Sitzplätze" value={`${vehicle.seats}`} />
              ) : null}
            </div>

            {/* Damage indicator */}
            {vehicle.hasDamage ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                  Vorschäden
                </Badge>
                {vehicle.damageDescription ? (
                  <span className="text-sm text-muted-foreground">{vehicle.damageDescription}</span>
                ) : null}
              </div>
            ) : null}

            {/* Features */}
            {features.length > 0 ? (
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-muted-foreground">Ausstattung</p>
                <div className="flex flex-wrap gap-2">
                  {features.map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Notes */}
            {vehicle.notes ? (
              <div className="mt-6">
                <p className="mb-1 text-sm font-medium text-muted-foreground">Besondere Informationen</p>
                <div
                  className="text-sm prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold [&_p]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: vehicle.notes }}
                />
              </div>
            ) : null}

            {vehicle.internalNotes ? (
              <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="mb-1 text-sm font-medium text-amber-300">Interne Bemerkungen</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{vehicle.internalNotes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Price section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {vehicle.marginTaxed ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Differenzbesteuert (&sect;25a UStG)</p>
                  <p className="text-2xl font-bold">{formatPrice(vehicle.sellingPrice)}</p>
                  <p className="text-xs text-muted-foreground">Endpreis</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Netto</p>
                  <p className="text-lg font-semibold">{formatPrice(vehicle.sellingPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">MwSt ({vehicle.taxRate}%)</p>
                  <p className="text-sm">{formatPrice(taxAmount)}</p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">Brutto</p>
                  <p className="text-2xl font-bold">{formatPrice(grossPrice)}</p>
                </div>
              </>
            )}

            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Einkauf</span>
                <span>{formatPrice(vehicle.purchasePrice)}</span>
              </div>
              {exportAdditionalCosts > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Exportkosten</span>
                  <span className="text-orange-500">{formatPrice(exportAdditionalCosts)}</span>
                </div>
              ) : null}
              {manualAdditionalCosts > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sonstige Zusatzkosten</span>
                  <span className="text-orange-500">{formatPrice(manualAdditionalCosts)}</span>
                </div>
              ) : null}
              {totalAdditionalCosts > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Gesamtkosten</span>
                  <span className="font-medium">{formatPrice(totalInvested)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Marge</span>
                <span className={margin >= 0 ? "text-emerald-500 font-medium" : "text-red-500 font-medium"}>
                  {formatPrice(margin)}
                </span>
              </div>
              {vehicle.dealerPrice != null ? (
                <div className="flex items-center justify-between text-sm border-t pt-2 mt-2">
                  <span className="text-muted-foreground">Händlerpreis</span>
                  <span className="font-medium">{formatPrice(vehicle.dealerPrice)}</span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="images">
            Bilder ({vehicle.images?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="documents">
            Dokumente ({vehicle.documents?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="costs">
            Kosten ({costBreakdown.length})
          </TabsTrigger>
          <TabsTrigger value="customer">Kunde</TabsTrigger>
          <TabsTrigger value="sales">Verkäufe</TabsTrigger>
          <TabsTrigger value="worklog">
            Laufzettel
            <Badge variant="outline" className="ml-1.5 text-xs py-0 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20">Intern</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="mt-4">
          <VehicleImagesTab
            vehicleId={vehicle.id}
            images={vehicle.images ?? []}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <VehicleDocumentsTab
            vehicleId={vehicle.id}
            documents={vehicle.documents ?? []}
          />
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          <CostsSection
            vehicleId={vehicle.id}
            costBreakdown={costBreakdown}
            manualAdditionalCosts={manualAdditionalCosts}
            exportAdditionalCosts={exportAdditionalCosts}
            totalAdditionalCosts={totalAdditionalCosts}
            purchasePrice={vehicle.purchasePrice}
            onAddCost={() => setAddCostOpen(true)}
            queryClient={queryClient}
          />
        </TabsContent>

        <TabsContent value="customer" className="mt-4">
          <CustomerSection customer={vehicle.customer} />
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <SalesSection sales={vehicle.sales ?? []} />
        </TabsContent>

        <TabsContent value="worklog" className="mt-4">
          <WorkLogTab vehicleId={vehicle.id} workLog={vehicle.workLog ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ----- Sub-components -----

function HeroImages({
  images,
  brand,
  model,
}: {
  images: Vehicle["images"];
  brand: string;
  model: string;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    const syncState = () => {
      setCurrentIndex(api.selectedScrollSnap());
      setSnapCount(api.scrollSnapList().length);
    };

    syncState();
    api.on("select", syncState);
    api.on("reInit", syncState);

    return () => {
      api.off("select", syncState);
      api.off("reInit", syncState);
    };
  }, [api]);

  if (!images || images.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border bg-muted/50 sm:h-64 lg:h-80">
        <div className="flex flex-col items-center text-muted-foreground">
          <Car className="mb-2 h-12 w-12" />
          <p className="text-sm">Keine Bilder vorhanden</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border bg-muted/40 px-12 py-4">
      <Carousel
        setApi={setApi}
        opts={{
          align: "start",
          containScroll: "trimSnaps",
          dragFree: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-3">
          {images.map((image, index) => (
            <CarouselItem
              key={image.id}
              className="pl-3 basis-full md:basis-1/2 xl:basis-1/3"
            >
              <div className="overflow-hidden rounded-xl border bg-muted/60">
                <img
                  src={getFileUrl(image.url)}
                  alt={`${brand} ${model} Bild ${index + 1}`}
                  className="h-[220px] w-full object-contain bg-black/5 p-2 sm:h-[260px] lg:h-[300px]"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {images.length > 1 ? (
          <>
            <CarouselPrevious className="left-3 top-1/2 h-9 w-9 -translate-y-1/2 border-0 bg-black/50 text-white hover:bg-black/70" />
            <CarouselNext className="right-3 top-1/2 h-9 w-9 -translate-y-1/2 border-0 bg-black/50 text-white hover:bg-black/70" />
          </>
        ) : null}
      </Carousel>
      {snapCount > 1 ? (
        <div className="mt-4 flex justify-center gap-1.5">
          {Array.from({ length: snapCount }).map((_, i) => (
            <button
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === currentIndex ? "w-6 bg-white" : "w-2 bg-white/40"
              }`}
              onClick={() => api?.scrollTo(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function CustomerSection({
  customer,
}: {
  customer: Vehicle["customer"];
}) {
  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">
          Kein Kunde zugewiesen
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <p className="font-medium">
            {customer.firstName} {customer.lastName}
          </p>
          {customer.company ? (
            <p className="text-sm text-muted-foreground">{customer.company}</p>
          ) : null}
          {customer.email ? (
            <p className="text-sm">
              <a href={`mailto:${customer.email}`} className="text-amber-600 hover:underline">
                {customer.email}
              </a>
            </p>
          ) : null}
          {customer.phone ? (
            <p className="text-sm">
              <a href={`tel:${customer.phone}`} className="text-amber-600 hover:underline">
                {customer.phone}
              </a>
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" asChild className="mt-4">
          <Link to={`/customers/${customer.id}`}>Kundenprofil anzeigen</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SalesSection({ sales }: { sales: Vehicle["sales"] }) {
  if (!sales || sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">
          Keine Verkäufe vorhanden
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sales.map((sale) => (
        <Card key={sale.id}>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium">{formatPrice(sale.salePrice)}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(sale.saleDate).toLocaleDateString("de-DE")}
              </p>
              {sale.customer ? (
                <p className="text-sm text-muted-foreground">
                  {sale.customer.firstName} {sale.customer.lastName}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Costs Section ──────────────────────────────────────────────

function CostsSection({
  vehicleId,
  costBreakdown,
  manualAdditionalCosts,
  exportAdditionalCosts,
  totalAdditionalCosts,
  purchasePrice,
  onAddCost,
  queryClient,
}: {
  vehicleId: string;
  costBreakdown: VehicleCostBreakdownItem[];
  manualAdditionalCosts: number;
  exportAdditionalCosts: number;
  totalAdditionalCosts: number;
  purchasePrice: number;
  onAddCost: () => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const deleteCostMutation = useMutation({
    mutationFn: (costId: string) =>
      api.delete(`/api/vehicles/${vehicleId}/costs/${costId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      toast.success("Kosten gelöscht");
    },
    onError: () => {
      toast.error("Fehler beim Löschen");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {costBreakdown.length === 0
              ? "Keine Kosten erfasst"
              : `${costBreakdown.length} Posten · Gesamt: ${formatPrice(totalAdditionalCosts)}`}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={onAddCost}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Kosten hinzufügen
        </Button>
      </div>

      {costBreakdown.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Receipt className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Noch keine Kosten erfasst
          </p>
          <Button size="sm" variant="ghost" className="mt-3" onClick={onAddCost}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Ersten Kosten hinzufügen
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {costBreakdown.map((cost) => (
            <Card key={cost.id}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      cost.category === "export" ? "bg-sky-500/10" : "bg-orange-500/10"
                    }`}
                  >
                    <Receipt
                      className={`h-4 w-4 ${
                        cost.category === "export" ? "text-sky-500" : "text-orange-500"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{cost.label}</p>
                    <div className="mt-0.5">
                      <Badge
                        variant="outline"
                        className={
                          cost.category === "export"
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-500"
                            : "border-orange-500/30 bg-orange-500/10 text-orange-500"
                        }
                      >
                        {cost.category === "export" ? "Export" : "Zusatzkosten"}
                      </Badge>
                    </div>
                    {cost.notes ? (
                      <p className="text-xs text-muted-foreground">{cost.notes}</p>
                    ) : null}
                    {cost.createdAt ? (
                      <p className="text-xs text-muted-foreground">
                        {new Date(cost.createdAt).toLocaleDateString("de-DE")}
                      </p>
                    ) : cost.category === "export" ? (
                      <p className="text-xs text-muted-foreground">Aus den Exportkosten des Fahrzeugs</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${
                      cost.category === "export" ? "text-sky-500" : "text-orange-500"
                    }`}
                  >
                    {formatPrice(cost.amount)}
                  </span>
                  {cost.category === "manual" ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={deleteCostMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Kosten löschen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{cost.label}" ({formatPrice(cost.amount)}) wird unwiderruflich gelöscht.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteCostMutation.mutate(cost.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Summary row */}
          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div>
                <p className="text-sm font-medium">Gesamte Nebenkosten</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Einkauf {formatPrice(purchasePrice)} + Nebenkosten</p>
                  {exportAdditionalCosts > 0 ? (
                    <p>Export: {formatPrice(exportAdditionalCosts)}</p>
                  ) : null}
                  {manualAdditionalCosts > 0 ? (
                    <p>Sonstige Zusatzkosten: {formatPrice(manualAdditionalCosts)}</p>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-orange-500">
                  {formatPrice(totalAdditionalCosts)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Gesamt: {formatPrice(purchasePrice + totalAdditionalCosts)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Sell Dialog ────────────────────────────────────────────────

function SellDialog({
  open,
  onOpenChange,
  vehicle,
  queryClient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const gross = vehicle.marginTaxed
    ? vehicle.sellingPrice
    : vehicle.sellingPrice * (1 + vehicle.taxRate / 100);

  const [customerId, setCustomerId] = useState("");
  const [salePrice, setSalePrice] = useState(gross.toFixed(2));
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [exportEnabled, setExportEnabled] = useState(vehicle.exportEnabled ?? false);
  const [transportCostDomestic, setTransportCostDomestic] = useState(vehicle.transportCostDomestic?.toString() ?? "");
  const [transportCostAbroad, setTransportCostAbroad] = useState(vehicle.transportCostAbroad?.toString() ?? "");
  const [customsDuties, setCustomsDuties] = useState(vehicle.customsDuties?.toString() ?? "");
  const [registrationFees, setRegistrationFees] = useState(vehicle.registrationFees?.toString() ?? "");
  const [repairCostsAbroad, setRepairCostsAbroad] = useState(vehicle.repairCostsAbroad?.toString() ?? "");

  const exportTotal =
    (parseFloat(transportCostDomestic) || 0) +
    (parseFloat(transportCostAbroad) || 0) +
    (parseFloat(customsDuties) || 0) +
    (parseFloat(registrationFees) || 0) +
    (parseFloat(repairCostsAbroad) || 0);

  // New customer inline form state
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<Customer[]>("/api/customers"),
    enabled: open,
  });

  const createCustomerMutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string; firstName: string; lastName: string }>("/api/customers", {
        firstName: newFirstName,
        lastName: newLastName,
        phone: newPhone || undefined,
        email: newEmail || undefined,
      }),
    onSuccess: (newCustomer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCustomerId(newCustomer.id);
      setShowNewCustomer(false);
      setNewFirstName("");
      setNewLastName("");
      setNewPhone("");
      setNewEmail("");
      toast.success("Kunde angelegt");
    },
    onError: () => {
      toast.error("Fehler beim Anlegen des Kunden");
    },
  });

  const sellMutation = useMutation({
    mutationFn: async () => {
      // If export fields changed, update vehicle first
      if (exportEnabled !== vehicle.exportEnabled ||
          (exportEnabled && (
            transportCostDomestic !== (vehicle.transportCostDomestic?.toString() ?? "") ||
            transportCostAbroad !== (vehicle.transportCostAbroad?.toString() ?? "") ||
            customsDuties !== (vehicle.customsDuties?.toString() ?? "") ||
            registrationFees !== (vehicle.registrationFees?.toString() ?? "") ||
            repairCostsAbroad !== (vehicle.repairCostsAbroad?.toString() ?? "")
          ))) {
        await api.put(`/api/vehicles/${vehicle.id}`, {
          exportEnabled,
          transportCostDomestic: exportEnabled && transportCostDomestic !== "" ? parseFloat(transportCostDomestic) : undefined,
          transportCostAbroad: exportEnabled && transportCostAbroad !== "" ? parseFloat(transportCostAbroad) : undefined,
          customsDuties: exportEnabled && customsDuties !== "" ? parseFloat(customsDuties) : undefined,
          registrationFees: exportEnabled && registrationFees !== "" ? parseFloat(registrationFees) : undefined,
          repairCostsAbroad: exportEnabled && repairCostsAbroad !== "" ? parseFloat(repairCostsAbroad) : undefined,
        });
      }
      return api.post("/api/sales", {
        vehicleId: vehicle.id,
        customerId,
        salePrice: parseFloat(salePrice),
        taxRate: vehicle.taxRate,
        saleDate: new Date(saleDate).toISOString(),
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicle.id] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Fahrzeug erfolgreich verkauft!");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Fehler beim Verkauf");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fahrzeug verkaufen</DialogTitle>
          <DialogDescription>
            {vehicle.brand} {vehicle.model} ({vehicle.vehicleNumber})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer */}
          <div className="space-y-2">
            <Label>Käufer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Kunden auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                    {c.company ? ` – ${c.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Toggle new customer form */}
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
              onClick={() => setShowNewCustomer((v) => !v)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {showNewCustomer ? "Abbrechen" : "Neuen Kunden anlegen"}
            </button>

            {/* Inline new customer form */}
            {showNewCustomer ? (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Vorname</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="Max"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nachname</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="Mustermann"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefon</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="+49 ..."
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-Mail</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="max@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!newFirstName || !newLastName || createCustomerMutation.isPending}
                  onClick={() => createCustomerMutation.mutate()}
                >
                  {createCustomerMutation.isPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-3.5 w-3.5" />
                  )}
                  Kunden speichern
                </Button>
              </div>
            ) : null}
          </div>

          {/* Sale price */}
          <div className="space-y-2">
            <Label>Verkaufspreis (Brutto in €)</Label>
            <Input
              type="number"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
          </div>

          {/* Sale date */}
          <div className="space-y-2">
            <Label>Verkaufsdatum</Label>
            <Input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notizen (optional)</Label>
            <Textarea
              rows={2}
              placeholder="Zahlungsart, Bemerkungen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Export toggle */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Export</p>
                <p className="text-xs text-muted-foreground">Fahrzeug wird exportiert</p>
              </div>
              <Switch checked={exportEnabled} onCheckedChange={setExportEnabled} />
            </div>

            {exportEnabled && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Transportkosten Inland (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={transportCostDomestic}
                    onChange={(e) => setTransportCostDomestic(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Transportkosten Ausland (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={transportCostAbroad}
                    onChange={(e) => setTransportCostAbroad(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Zollgebühren (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={customsDuties}
                    onChange={(e) => setCustomsDuties(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Gebühren Zulassung (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={registrationFees}
                    onChange={(e) => setRegistrationFees(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reparaturkosten Ausland (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={repairCostsAbroad}
                    onChange={(e) => setRepairCostsAbroad(e.target.value)}
                  />
                </div>
                {exportTotal > 0 && (
                  <div className="col-span-2 flex items-center justify-between rounded bg-muted/50 px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">Gesamte Exportkosten</span>
                    <span className="font-semibold">{formatPrice(exportTotal)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!customerId || sellMutation.isPending}
            onClick={() => sellMutation.mutate()}
          >
            {sellMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-4 w-4" />
            )}
            Verkauf abschließen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
