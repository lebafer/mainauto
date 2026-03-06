import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
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

interface CustomerFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phone2: string;
  address: string;
  city: string;
  zip: string;
  country: string;
  company: string;
  taxId: string;
  notes: string;
  customerType: "privat" | "gewerblich";
}

interface Customer extends CustomerFormData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

function EditSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-32 rounded-lg" />
    </div>
  );
}

export default function CustomerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api.get<Customer>(`/api/customers/${id}`),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<CustomerFormData>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      phone2: "",
      address: "",
      city: "",
      zip: "",
      country: "",
      company: "",
      taxId: "",
      notes: "",
      customerType: "privat",
    },
  });

  const watchedCustomerType = watch("customerType");

  // Populate form when data loads
  useEffect(() => {
    if (customer) {
      reset({
        firstName: customer.firstName ?? "",
        lastName: customer.lastName ?? "",
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        phone2: customer.phone2 ?? "",
        address: customer.address ?? "",
        city: customer.city ?? "",
        zip: customer.zip ?? "",
        country: customer.country ?? "",
        company: customer.company ?? "",
        taxId: customer.taxId ?? "",
        notes: customer.notes ?? "",
        customerType: customer.customerType ?? "privat",
      });
    }
  }, [customer, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: CustomerFormData) =>
      api.put<Customer>(`/api/customers/${id}`, data),
    onSuccess: () => {
      toast.success("Kunde erfolgreich aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate(`/customers/${id}`);
    },
    onError: () => {
      toast.error("Fehler beim Aktualisieren des Kunden");
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return <EditSkeleton />;
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground mb-4">Kunde nicht gefunden</p>
        <Button asChild variant="outline">
          <Link to="/customers">Zuruck zur Ubersicht</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/customers/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Kunde bearbeiten
          </h1>
          <p className="text-muted-foreground">
            {customer.firstName} {customer.lastName}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        {/* Kundentyp Toggle - always at top */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kundentyp</CardTitle>
            <CardDescription>
              Wählen Sie den Typ des Kunden aus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={control}
              name="customerType"
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

        {watchedCustomerType === "privat" ? (
          <>
            {/* Privat: Persönliche Daten */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Persönliche Daten</CardTitle>
                <CardDescription>
                  Name und Kontaktdaten des Kunden
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Vorname *</Label>
                  <Input
                    id="firstName"
                    placeholder="Max"
                    {...register("firstName", {
                      required: "Vorname ist erforderlich",
                    })}
                  />
                  {errors.firstName ? (
                    <p className="text-sm text-destructive">
                      {errors.firstName.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nachname *</Label>
                  <Input
                    id="lastName"
                    placeholder="Mustermann"
                    {...register("lastName", {
                      required: "Nachname ist erforderlich",
                    })}
                  />
                  {errors.lastName ? (
                    <p className="text-sm text-destructive">
                      {errors.lastName.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="max@beispiel.de"
                    {...register("email")}
                  />
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
              </CardContent>
            </Card>

            {/* Privat: Adresse */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Adresse</CardTitle>
                <CardDescription>Anschrift des Kunden</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Strasse und Hausnummer</Label>
                  <Input
                    id="address"
                    placeholder="Musterstrasse 1"
                    {...register("address")}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="zip">PLZ</Label>
                    <Input id="zip" placeholder="12345" {...register("zip")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ort</Label>
                    <Input
                      id="city"
                      placeholder="Musterstadt"
                      {...register("city")}
                    />
                  </div>
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

            {/* Privat: Steuerdaten */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Steuerdaten</CardTitle>
                <CardDescription>Steuerliche Angaben (optional)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-w-sm">
                  <Label htmlFor="taxId">Steuernummer</Label>
                  <Input
                    id="taxId"
                    placeholder="12/345/67890"
                    {...register("taxId")}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Gewerblich: Unternehmensdaten */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Unternehmensdaten</CardTitle>
                <CardDescription>
                  Firmenangaben und Ansprechpartner
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="company">Firma *</Label>
                  <Input
                    id="company"
                    placeholder="Musterfirma GmbH"
                    {...register("company", {
                      required: "Firma ist erforderlich",
                    })}
                  />
                  {errors.company ? (
                    <p className="text-sm text-destructive">
                      {errors.company.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="taxId">USt-IdNr.</Label>
                  <Input
                    id="taxId"
                    placeholder="DE123456789"
                    {...register("taxId")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Ansprechpartner Vorname</Label>
                  <Input
                    id="firstName"
                    placeholder="Max"
                    {...register("firstName")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Ansprechpartner Nachname</Label>
                  <Input
                    id="lastName"
                    placeholder="Mustermann"
                    {...register("lastName")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Gewerblich: Kontakt */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Kontakt</CardTitle>
                <CardDescription>
                  Kontaktdaten des Unternehmens
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="info@musterfirma.de"
                    {...register("email")}
                  />
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
              </CardContent>
            </Card>

            {/* Gewerblich: Firmenadresse */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Adresse</CardTitle>
                <CardDescription>Firmenadresse</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Strasse und Hausnummer</Label>
                  <Input
                    id="address"
                    placeholder="Musterstrasse 1"
                    {...register("address")}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="zip">PLZ</Label>
                    <Input id="zip" placeholder="12345" {...register("zip")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ort</Label>
                    <Input
                      id="city"
                      placeholder="Musterstadt"
                      {...register("city")}
                    />
                  </div>
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
            <CardDescription>
              Zusätzliche Informationen zum Kunden
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="notes">Notizen</Label>
              <Textarea
                id="notes"
                placeholder="Anmerkungen zum Kunden..."
                rows={4}
                {...register("notes")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Speichern
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={`/customers/${id}`}>Abbrechen</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
