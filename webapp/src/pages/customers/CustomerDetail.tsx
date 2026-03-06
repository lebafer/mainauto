import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  FileText,
  Pencil,
  Trash2,
  Upload,
  Car,
  Receipt,
  Loader2,
  Download,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// Types
interface CustomerVehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  status: string;
  sellingPrice: number;
}

interface CustomerDocument {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}

interface CustomerSale {
  id: string;
  salePrice: number;
  saleDate: string;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    year: number;
  };
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  company: string | null;
  taxId: string | null;
  notes: string | null;
  vehicles: CustomerVehicle[];
  documents: CustomerDocument[];
  sales: CustomerSale[];
  createdAt: string;
  updatedAt: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("de-DE").format(new Date(dateString));

// Loading skeleton
function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

// Document upload section
function DocumentUpload({
  customerId,
  onUploaded,
}: {
  customerId: string;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docName, setDocName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!selectedFile || !docName.trim()) return;

    setUploading(true);
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", docName.trim());

      const res = await fetch(
        `${baseUrl}/api/customers/${customerId}/documents`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      if (!res.ok) throw new Error("Upload fehlgeschlagen");

      toast.success("Dokument hochgeladen");
      setDocName("");
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch {
      toast.error("Fehler beim Hochladen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium">Neues Dokument hochladen</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <Label htmlFor="docName" className="text-xs text-muted-foreground">
            Bezeichnung
          </Label>
          <Input
            id="docName"
            placeholder="z.B. Kaufvertrag"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="docFile" className="text-xs text-muted-foreground">
            Datei
          </Label>
          <Input
            id="docFile"
            type="file"
            ref={fileRef}
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="flex items-end">
          <Button
            onClick={handleUpload}
            disabled={uploading || !selectedFile || !docName.trim()}
            size="sm"
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Hochladen
          </Button>
        </div>
      </div>
    </div>
  );
}

// Contact info item
function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: customer,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api.get<Customer>(`/api/customers/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/customers/${id}`),
    onSuccess: () => {
      toast.success("Kunde geloscht");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate("/customers");
    },
    onError: () => {
      toast.error("Fehler beim Loschen");
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) =>
      api.delete(`/api/customers/${id}/documents/${docId}`),
    onSuccess: () => {
      toast.success("Dokument geloscht");
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
    },
    onError: () => {
      toast.error("Fehler beim Loschen des Dokuments");
    },
  });

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error || !customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground mb-4">Kunde nicht gefunden</p>
        <Button asChild variant="outline">
          <Link to="/customers">Zuruck zur Ubersicht</Link>
        </Button>
      </div>
    );
  }

  const fullAddress = [customer.address, customer.zip, customer.city]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1">
            <Link to="/customers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {customer.firstName} {customer.lastName}
            </h1>
            {customer.company ? (
              <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
                <Building2 className="h-3.5 w-3.5" />
                {customer.company}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-14 sm:ml-0">
          <Button variant="outline" asChild>
            <Link to={`/customers/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Bearbeiten
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Loschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Kunden loschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Mochten Sie {customer.firstName} {customer.lastName} wirklich
                  loschen? Diese Aktion kann nicht ruckgangig gemacht werden.
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
        </div>
      </div>

      {/* Contact info grid */}
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem icon={Mail} label="E-Mail" value={customer.email} />
            <InfoItem icon={Phone} label="Telefon" value={customer.phone} />
            <InfoItem
              icon={MapPin}
              label="Adresse"
              value={fullAddress || null}
            />
            {customer.taxId ? (
              <InfoItem
                icon={FileText}
                label="Steuernr. / USt-IdNr."
                value={customer.taxId}
              />
            ) : null}
          </div>
          {customer.notes ? (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notizen</p>
                <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles" className="gap-1.5">
            <Car className="h-3.5 w-3.5" />
            Fahrzeuge
            {customer.vehicles.length > 0 ? (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {customer.vehicles.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Dokumente
            {customer.documents.length > 0 ? (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {customer.documents.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Verkaufe
            {customer.sales.length > 0 ? (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {customer.sales.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Vehicles tab */}
        <TabsContent value="vehicles">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fahrzeuge</CardTitle>
              <CardDescription>
                Fahrzeuge, die diesem Kunden zugeordnet sind
              </CardDescription>
            </CardHeader>
            <CardContent>
              {customer.vehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Car className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Keine Fahrzeuge zugeordnet
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fahrzeug</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Baujahr
                      </TableHead>
                      <TableHead className="text-right">Preis</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.vehicles.map((vehicle) => (
                      <TableRow
                        key={vehicle.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                      >
                        <TableCell className="font-medium">
                          {vehicle.brand} {vehicle.model}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {vehicle.year}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(vehicle.sellingPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{vehicle.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dokumente</CardTitle>
              <CardDescription>
                Hochgeladene Dokumente fur diesen Kunden
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DocumentUpload
                customerId={customer.id}
                onUploaded={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["customer", id],
                  })
                }
              />
              {customer.documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Keine Dokumente vorhanden
                  </p>
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {customer.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {doc.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(doc.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {doc.url ? (
                          <Button variant="ghost" size="icon" asChild>
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteDocMutation.mutate(doc.id)}
                          disabled={deleteDocMutation.isPending}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales tab */}
        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verkaufe</CardTitle>
              <CardDescription>
                Verkaufshistorie fur diesen Kunden
              </CardDescription>
            </CardHeader>
            <CardContent>
              {customer.sales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Receipt className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Keine Verkaufe vorhanden
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fahrzeug</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Datum
                      </TableHead>
                      <TableHead className="text-right">Preis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.sales.map((sale) => (
                      <TableRow
                        key={sale.id}
                        className="cursor-pointer"
                        onClick={() =>
                          navigate(`/vehicles/${sale.vehicle.id}`)
                        }
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {sale.vehicle.brand} {sale.vehicle.model}
                            </p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {formatDate(sale.saleDate)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {formatDate(sale.saleDate)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(sale.salePrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
