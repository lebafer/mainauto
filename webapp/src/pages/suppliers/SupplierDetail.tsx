import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Building2,
  User,
  Phone,
  Globe,
  MapPin,
  CreditCard,
  FileText,
  Car,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/vehicles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SupplierVehicle {
  id: string;
  vehicleNumber: string;
  brand: string;
  model: string;
  purchasePrice: number;
  status: string;
  firstRegistration?: string | null;
  year?: number | null;
}

interface Supplier {
  id: string;
  name: string;
  supplierType: "privat" | "gewerblich";
  address?: string | null;
  country?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  phone2?: string | null;
  website?: string | null;
  iban?: string | null;
  notes?: string | null;
  vehicles?: SupplierVehicle[];
}

const STATUS_LABELS: Record<string, string> = {
  available: "Verfügbar",
  reserved: "Reserviert",
  sold: "Verkauft",
};

const STATUS_CLASSES: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  reserved: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  sold: "bg-red-500/10 text-red-500 border-red-500/20",
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-all">{value}</p>
      </div>
    </div>
  );
}

export default function SupplierDetail() {
  const { id } = useParams();

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => api.get<Supplier>(`/api/suppliers-db/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground mb-4">Lieferant nicht gefunden</p>
        <Button asChild variant="outline">
          <Link to="/suppliers">Zurück zur Übersicht</Link>
        </Button>
      </div>
    );
  }

  const vehicles = supplier.vehicles ?? [];
  const totalPurchaseVolume = vehicles.reduce(
    (sum, v) => sum + (v.purchasePrice ?? 0),
    0
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1">
            <Link to="/suppliers">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{supplier.name}</h1>
              {supplier.supplierType === "gewerblich" ? (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1">
                  <Building2 className="h-3 w-3" />
                  Gewerblich
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
                  <User className="h-3 w-3" />
                  Privat
                </Badge>
              )}
            </div>
            {supplier.country ? (
              <p className="text-muted-foreground mt-1">{supplier.country}</p>
            ) : null}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="sm:shrink-0">
          <Link to={`/suppliers/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Bearbeiten
          </Link>
        </Button>
      </div>

      {/* Info cards grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Kontaktdaten */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kontaktdaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {supplier.address ? (
              <InfoRow icon={MapPin} label="Adresse" value={supplier.address} />
            ) : null}
            {supplier.country ? (
              <InfoRow icon={MapPin} label="Land" value={supplier.country} />
            ) : null}
            {supplier.phone ? (
              <InfoRow icon={Phone} label="Telefon" value={supplier.phone} />
            ) : null}
            {supplier.phone2 ? (
              <InfoRow icon={Phone} label="Zweite Telefonnummer" value={supplier.phone2} />
            ) : null}
            {supplier.website ? (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Webseite</p>
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-amber-600 hover:underline break-all"
                  >
                    {supplier.website}
                  </a>
                </div>
              </div>
            ) : null}
            {supplier.contactPerson ? (
              <InfoRow icon={User} label="Ansprechpartner" value={supplier.contactPerson} />
            ) : null}
            {!supplier.address && !supplier.phone && !supplier.website && !supplier.contactPerson ? (
              <p className="text-sm text-muted-foreground">Keine Kontaktdaten hinterlegt</p>
            ) : null}
          </CardContent>
        </Card>

        {/* Bankdaten */}
        {supplier.iban ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bankdaten</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow icon={CreditCard} label="IBAN" value={supplier.iban} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Fahrzeuge Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Car className="h-5 w-5 text-muted-foreground" />
            Fahrzeuge
            <Badge variant="secondary" className="ml-1">{vehicles.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Car className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Noch keine Fahrzeuge von diesem Lieferanten
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>FZ-Nr.</TableHead>
                      <TableHead>Marke / Modell</TableHead>
                      <TableHead className="hidden sm:table-cell">Erstzulassung</TableHead>
                      <TableHead>Einkaufspreis</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <Link
                            to={`/vehicles/${v.id}`}
                            className="font-mono text-xs text-amber-600 hover:underline"
                          >
                            {v.vehicleNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link to={`/vehicles/${v.id}`} className="hover:underline">
                            {v.brand} {v.model}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {v.firstRegistration
                            ? new Date(v.firstRegistration).toLocaleDateString("de-DE", {
                                month: "2-digit",
                                year: "numeric",
                              })
                            : v.year
                            ? v.year
                            : "--"}
                        </TableCell>
                        <TableCell>{formatPrice(v.purchasePrice)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={STATUS_CLASSES[v.status] ?? ""}
                          >
                            {STATUS_LABELS[v.status] ?? v.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Total volume */}
              <div className="mt-4 rounded-lg border bg-muted/30 px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-medium">
                  Gesamtes Einkaufsvolumen
                </p>
                <p className="text-base font-bold">{formatPrice(totalPurchaseVolume)}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {supplier.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              Notizen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{supplier.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
