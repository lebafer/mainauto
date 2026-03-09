import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const COUNTRIES = [
  "Deutschland",
  "Österreich",
  "Schweiz",
  "Portugal",
  "Frankreich",
  "Spanien",
  "Italien",
  "Niederlande",
  "Belgien",
  "Polen",
  "Tschechien",
  "Ungarn",
  "Rumänien",
  "Kroatien",
  "Serbien",
  "Sonstige",
];

interface SupplierFormData {
  name: string;
  supplierType: "privat" | "gewerblich";
  contactPerson: string;
  address: string;
  country: string;
  phone: string;
  phone2: string;
  email: string;
  website: string;
  iban: string;
  notes: string;
}

interface CreatedSupplier {
  id: string;
}

export default function SupplierNew() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<SupplierFormData>({
    defaultValues: {
      name: "",
      supplierType: "gewerblich",
      contactPerson: "",
      address: "",
      country: "",
      phone: "",
      phone2: "",
      email: "",
      website: "",
      iban: "",
      notes: "",
    },
  });

  const watchedType = watch("supplierType");

  const createMutation = useMutation({
    mutationFn: (data: SupplierFormData) =>
      api.post<CreatedSupplier>("/api/suppliers-db", data),
    onSuccess: (result) => {
      toast.success("Lieferant erfolgreich angelegt");
      navigate(`/suppliers/${result.id}`);
    },
    onError: () => {
      toast.error("Fehler beim Anlegen des Lieferanten");
    },
  });

  const onSubmit = (data: SupplierFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/suppliers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Neuer Lieferant</h1>
          <p className="text-muted-foreground">Neuen Lieferanten anlegen</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        {/* Lieferantentyp Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lieferantentyp</CardTitle>
            <CardDescription>Wählen Sie den Typ des Lieferanten aus</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={control}
              name="supplierType"
              render={({ field }) => (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => field.onChange("privat")}
                    className={`flex-1 py-3 px-6 rounded-xl text-base font-semibold border-2 transition-all ${
                      field.value === "privat"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:bg-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    Privat
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange("gewerblich")}
                    className={`flex-1 py-3 px-6 rounded-xl text-base font-semibold border-2 transition-all ${
                      field.value === "gewerblich"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:bg-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    Gewerblich
                  </button>
                </div>
              )}
            />
          </CardContent>
        </Card>

        {watchedType === "gewerblich" ? (
          <>
            {/* Gewerblich: Firmendaten */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Firmendaten</CardTitle>
                <CardDescription>Firmenname und Ansprechpartner</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Firmenname *</Label>
                  <Input
                    id="name"
                    placeholder="Musterfirma GmbH"
                    {...register("name", { required: "Firmenname ist erforderlich" })}
                  />
                  {errors.name ? (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contactPerson">Ansprechpartner</Label>
                  <Input
                    id="contactPerson"
                    placeholder="Max Mustermann"
                    {...register("contactPerson")}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    placeholder="DE89 3704 0044 0532 0130 00"
                    {...register("iban")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Gewerblich: Kontakt */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Kontakt</CardTitle>
                <CardDescription>Kontaktdaten des Unternehmens</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+49 123 456789"
                    {...register("phone")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone2">Zweite Telefonnummer</Label>
                  <Input
                    id="phone2"
                    type="tel"
                    placeholder="+49 123 456789"
                    {...register("phone2")}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="kontakt@beispiel.de"
                    {...register("email")}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="website">Webseite</Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://www.beispiel.de"
                    {...register("website")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Gewerblich: Adresse */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Adresse</CardTitle>
                <CardDescription>Firmenadresse</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Strasse, PLZ, Ort</Label>
                  <Input
                    id="address"
                    placeholder="Musterstrasse 1, 12345 Musterstadt"
                    {...register("address")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Land</Label>
                  <Controller
                    control={control}
                    name="country"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Land auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Privat: Persönliche Daten */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Persönliche Daten</CardTitle>
                <CardDescription>Name des Lieferanten</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="Max Mustermann"
                    {...register("name", { required: "Name ist erforderlich" })}
                  />
                  {errors.name ? (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+49 123 456789"
                    {...register("phone")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone2">Zweite Telefonnummer</Label>
                  <Input
                    id="phone2"
                    type="tel"
                    placeholder="+49 123 456789"
                    {...register("phone2")}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="max.mustermann@example.com"
                    {...register("email")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Privat: Adresse */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Adresse</CardTitle>
                <CardDescription>Anschrift des Lieferanten</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Strasse, PLZ, Ort</Label>
                  <Input
                    id="address"
                    placeholder="Musterstrasse 1, 12345 Musterstadt"
                    {...register("address")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Land</Label>
                  <Controller
                    control={control}
                    name="country"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Land auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Notizen - always shown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notizen</CardTitle>
            <CardDescription>Zusätzliche Informationen zum Lieferanten</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="notes">Notizen</Label>
              <Textarea
                id="notes"
                placeholder="Anmerkungen zum Lieferanten..."
                rows={4}
                {...register("notes")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Lieferant anlegen
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/suppliers">Abbrechen</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
