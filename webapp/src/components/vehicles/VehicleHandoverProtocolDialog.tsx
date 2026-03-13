import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CarFront, FileDown, Loader2, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { type Vehicle } from "@/lib/vehicles";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  HandoverProtocolSchema,
  type HandoverProtocol,
  type HandoverProtocolLoadResponse,
} from "../../../../backend/src/types";

const EMPTY_PROTOCOL = HandoverProtocolSchema.parse({});

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  company?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface VehicleHandoverProtocolDialogProps {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WheelSetPath = "mountedWheels" | "includedWheels";
type PartyPath = "giver" | "receiver";

const EXTERIOR_OPTIONS = [
  { value: "washed", label: "gewaschen" },
  { value: "lightly_soiled", label: "leicht verschmutzt" },
  { value: "heavily_soiled", label: "stark verschmutzt" },
] as const;

const INTERIOR_OPTIONS = [
  { value: "clean", label: "sauber" },
  { value: "lightly_soiled", label: "leicht verschmutzt" },
  { value: "heavily_soiled", label: "stark verschmutzt" },
] as const;

const FUEL_LEVEL_OPTIONS = [
  { value: "empty", label: "leer" },
  { value: "quarter", label: "1/4" },
  { value: "half", label: "1/2" },
  { value: "three_quarters", label: "3/4" },
  { value: "full", label: "voll" },
] as const;

const DOCUMENT_CHECKBOXES = [
  { name: "items.serviceBook" as const, label: "Serviceheft" },
  { name: "items.vehicleFolder" as const, label: "Bordmappe" },
  { name: "items.chargingCableType2" as const, label: "Ladekabel Typ 2" },
  { name: "items.chargingCableSchuko" as const, label: "Ladekabel Schuko" },
  { name: "items.registrationPart1" as const, label: "Zulassungsbescheinigung Teil 1" },
  { name: "items.registrationPart2" as const, label: "Zulassungsbescheinigung Teil 2" },
  { name: "items.cocCertificate" as const, label: "COC-Zertifikat" },
  { name: "items.parkingHeaterRemote" as const, label: "Fernbedienung Standheizung" },
  { name: "items.warningTriangle" as const, label: "Warndreieck" },
  { name: "items.safetyVest" as const, label: "Warnweste" },
  { name: "items.firstAidKit" as const, label: "Verbandkasten" },
] as const;

const WHEEL_CHECKBOXES = [
  { name: "summer" as const, label: "Sommerreifen" },
  { name: "winter" as const, label: "Winterreifen" },
  { name: "allSeason" as const, label: "Ganzjahresreifen" },
  { name: "alloy" as const, label: "Alufelgen" },
  { name: "steel" as const, label: "Stahlfelgen" },
  { name: "spareWheel" as const, label: "Reserverad" },
] as const;

function openPrintWindow(html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    throw new Error("Druckfenster konnte nicht geöffnet werden");
  }

  win.document.write(
    html + '<script>window.onload = function() { window.print(); }</s' + "cript>"
  );
  win.document.close();
}

function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function TextField({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</Label>
      <Input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CheckboxField({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm transition-colors hover:border-rose-300 hover:bg-rose-50/40">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <span>{label}</span>
    </label>
  );
}

function ChoiceGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</Label>
      <RadioGroup value={value} onValueChange={onChange} className="grid gap-2 md:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
              value === option.value
                ? "border-rose-500 bg-rose-50 text-rose-900"
                : "border-border/70 bg-background hover:border-rose-300 hover:bg-rose-50/40"
            )}
          >
            <RadioGroupItem value={option.value} />
            <span>{option.label}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

function PartyFields({
  title,
  path,
  form,
}: {
  title: string;
  path: PartyPath;
  form: ReturnType<typeof useForm<HandoverProtocol>>;
}) {
  const party = form.watch(path);

  return (
    <Section title={title}>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Name"
          value={party.name}
          onChange={(value) => form.setValue(`${path}.name`, value, { shouldDirty: true })}
        />
        <TextField
          label="Firma"
          value={party.company}
          onChange={(value) => form.setValue(`${path}.company`, value, { shouldDirty: true })}
        />
        <TextField
          label="Straße"
          value={party.street}
          onChange={(value) => form.setValue(`${path}.street`, value, { shouldDirty: true })}
        />
        <TextField
          label="PLZ, Ort"
          value={party.postalCodeCity}
          onChange={(value) => form.setValue(`${path}.postalCodeCity`, value, { shouldDirty: true })}
        />
        <TextField
          label="E-Mail"
          value={party.email}
          onChange={(value) => form.setValue(`${path}.email`, value, { shouldDirty: true })}
        />
        <TextField
          label="Telefon"
          value={party.phone}
          onChange={(value) => form.setValue(`${path}.phone`, value, { shouldDirty: true })}
        />
      </div>
    </Section>
  );
}

function WheelSection({
  title,
  path,
  form,
}: {
  title: string;
  path: WheelSetPath;
  form: ReturnType<typeof useForm<HandoverProtocol>>;
}) {
  const wheelSet = form.watch(path);

  return (
    <Section title={title}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {WHEEL_CHECKBOXES.map((option) => (
          <CheckboxField
            key={option.name}
            label={option.label}
            checked={wheelSet[option.name]}
            onCheckedChange={(checked) => form.setValue(`${path}.${option.name}`, checked, { shouldDirty: true })}
          />
        ))}
      </div>
      <Separator className="my-4" />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="vorne links (mm)"
          value={wheelSet.treadDepth.frontLeft}
          onChange={(value) => form.setValue(`${path}.treadDepth.frontLeft`, value, { shouldDirty: true })}
        />
        <TextField
          label="vorne rechts (mm)"
          value={wheelSet.treadDepth.frontRight}
          onChange={(value) => form.setValue(`${path}.treadDepth.frontRight`, value, { shouldDirty: true })}
        />
        <TextField
          label="hinten links (mm)"
          value={wheelSet.treadDepth.rearLeft}
          onChange={(value) => form.setValue(`${path}.treadDepth.rearLeft`, value, { shouldDirty: true })}
        />
        <TextField
          label="hinten rechts (mm)"
          value={wheelSet.treadDepth.rearRight}
          onChange={(value) => form.setValue(`${path}.treadDepth.rearRight`, value, { shouldDirty: true })}
        />
      </div>
    </Section>
  );
}

export function VehicleHandoverProtocolDialog({
  vehicle,
  open,
  onOpenChange,
}: VehicleHandoverProtocolDialogProps) {
  const isMobile = useIsMobile();
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [loadedSnapshot, setLoadedSnapshot] = useState<HandoverProtocol>(EMPTY_PROTOCOL);
  const lastAppliedCustomerIdRef = useRef<string | null>(null);

  const form = useForm<HandoverProtocol>({
    resolver: zodResolver(HandoverProtocolSchema),
    defaultValues: EMPTY_PROTOCOL,
  });

  const linkedCustomerId = vehicle.customerId ?? null;
  const showCustomerSelect = !linkedCustomerId;
  const receiverCustomerId = form.watch("receiverCustomerId");

  const handoverQuery = useQuery({
    queryKey: ["vehicle-handover-protocol", vehicle.id],
    queryFn: () => api.get<HandoverProtocolLoadResponse>(`/api/vehicles/${vehicle.id}/handover-protocol`),
    enabled: open,
  });

  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<CustomerOption[]>("/api/customers"),
    enabled: open && showCustomerSelect,
  });

  useEffect(() => {
    if (!handoverQuery.data) {
      return;
    }

    form.reset(handoverQuery.data.data);
    setLoadedSnapshot(handoverQuery.data.data);
    lastAppliedCustomerIdRef.current = handoverQuery.data.data.receiverCustomerId;
  }, [form, handoverQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: HandoverProtocol) =>
      api.put<HandoverProtocolLoadResponse>(`/api/vehicles/${vehicle.id}/handover-protocol`, payload),
    onSuccess: (response) => {
      form.reset(response.data);
      setLoadedSnapshot(response.data);
      lastAppliedCustomerIdRef.current = response.data.receiverCustomerId;
      toast.success("Übergabeprotokoll gespeichert");
    },
    onError: () => {
      toast.error("Übergabeprotokoll konnte nicht gespeichert werden");
    },
  });

  const isBusy = saveMutation.isPending;

  const selectedCustomer = useMemo(() => {
    return customersQuery.data?.find((customer) => customer.id === receiverCustomerId) ?? null;
  }, [customersQuery.data, receiverCustomerId]);

  useEffect(() => {
    if (!selectedCustomer || !showCustomerSelect || receiverCustomerId === lastAppliedCustomerIdRef.current) {
      return;
    }

    form.setValue("receiver.name", `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim(), { shouldDirty: true });
    form.setValue("receiver.company", selectedCustomer.company ?? "", { shouldDirty: true });
    form.setValue("receiver.street", selectedCustomer.address ?? "", { shouldDirty: true });
    form.setValue(
      "receiver.postalCodeCity",
      [selectedCustomer.zip, selectedCustomer.city].filter(Boolean).join(" "),
      { shouldDirty: true }
    );
    form.setValue("receiver.email", selectedCustomer.email ?? "", { shouldDirty: true });
    form.setValue("receiver.phone", selectedCustomer.phone ?? "", { shouldDirty: true });
    lastAppliedCustomerIdRef.current = receiverCustomerId;
  }, [form, receiverCustomerId, selectedCustomer, showCustomerSelect]);

  async function persistCurrentState(): Promise<HandoverProtocol | null> {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error("Bitte prüfen Sie die markierten Felder");
      return null;
    }

    const payload = HandoverProtocolSchema.parse(form.getValues());
    await saveMutation.mutateAsync(payload);
    return payload;
  }

  async function handleDownloadPdf() {
    const payload = await persistCurrentState();
    if (!payload) {
      return;
    }

    try {
      const response = await api.raw("/api/documents/generate-handover-protocol-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: vehicle.id, data: payload }),
      });

      if (!response.ok) {
        throw new Error("PDF-Erstellung fehlgeschlagen");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `Uebergabeprotokoll_${vehicle.vehicleNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("PDF heruntergeladen");
    } catch {
      toast.error("PDF konnte nicht erstellt werden");
    }
  }

  async function handlePrint() {
    const payload = await persistCurrentState();
    if (!payload) {
      return;
    }

    try {
      const response = await api.post<{ html: string; vehicleNumber: string }>(
        "/api/documents/generate-handover-protocol-html",
        { vehicleId: vehicle.id, data: payload }
      );
      openPrintWindow(response.html);
    } catch {
      toast.error("Druckansicht konnte nicht erstellt werden");
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && form.formState.isDirty && !isBusy) {
      setDiscardDialogOpen(true);
      return;
    }

    if (!nextOpen) {
      form.reset(loadedSnapshot);
    }

    onOpenChange(nextOpen);
  }

  const protocol = form.watch();

  const content = (
    <>
      <div className="space-y-6 px-1">
        <Section
          title="Fahrzeugdaten"
          description="Die interne Fahrzeugnummer und VIN werden automatisch übernommen, bleiben aber editierbar."
        >
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-900">
            <CarFront className="h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Interne Fahrzeugnummer: {protocol.vehicle.internalVehicleNumber || vehicle.vehicleNumber}</div>
              <div className="text-xs text-rose-800/80">VIN: {protocol.vehicle.vin || vehicle.vin || "nicht hinterlegt"}</div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Kennzeichen"
              value={protocol.vehicle.licensePlate}
              onChange={(value) => form.setValue("vehicle.licensePlate", value, { shouldDirty: true })}
            />
            <TextField
              label="Hersteller / Modell / Typ"
              value={protocol.vehicle.manufacturerModelType}
              onChange={(value) => form.setValue("vehicle.manufacturerModelType", value, { shouldDirty: true })}
            />
            <TextField
              label="Farbe"
              value={protocol.vehicle.color}
              onChange={(value) => form.setValue("vehicle.color", value, { shouldDirty: true })}
            />
            <TextField
              label="Kilometerstand"
              value={protocol.vehicle.mileage}
              onChange={(value) => form.setValue("vehicle.mileage", value, { shouldDirty: true })}
            />
            <TextField
              label="VIN"
              value={protocol.vehicle.vin}
              onChange={(value) => form.setValue("vehicle.vin", value, { shouldDirty: true })}
            />
            <TextField
              label="Interne Fahrzeugnummer"
              value={protocol.vehicle.internalVehicleNumber}
              onChange={(value) => form.setValue("vehicle.internalVehicleNumber", value, { shouldDirty: true })}
            />
          </div>
        </Section>

        <Section title="Übergabeinformationen">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Datum Übergabe"
              type="date"
              value={protocol.handover.date}
              onChange={(value) => form.setValue("handover.date", value, { shouldDirty: true })}
            />
            <TextField
              label="Uhrzeit Übergabe"
              type="time"
              value={protocol.handover.time}
              onChange={(value) => form.setValue("handover.time", value, { shouldDirty: true })}
            />
            <TextField
              label="Ort der Übergabe"
              value={protocol.handover.location}
              onChange={(value) => form.setValue("handover.location", value, { shouldDirty: true })}
            />
            <TextField
              label="Kraftstoffart"
              value={protocol.handover.fuelType}
              onChange={(value) => form.setValue("handover.fuelType", value, { shouldDirty: true })}
            />
          </div>
        </Section>

        <PartyFields title="Daten des Übergebenden" path="giver" form={form} />

        {showCustomerSelect ? (
          <Section title="Kunde übernehmen" description="Wenn kein Kunde am Fahrzeug verknüpft ist, können Sie hier einen Kunden auswählen.">
            <Controller
              control={form.control}
              name="receiverCustomerId"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Kunde</Label>
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={(value) => field.onChange(value)}
                    disabled={customersQuery.isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={customersQuery.isLoading ? "Kunden werden geladen..." : "Kunden auswählen"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customersQuery.data?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName}
                          {customer.company ? ` - ${customer.company}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
          </Section>
        ) : null}

        <PartyFields title="Daten des Übernehmenden" path="receiver" form={form} />

        <Section title="Fahrzeugzustand">
          <div className="grid gap-4 xl:grid-cols-3">
            <Controller
              control={form.control}
              name="condition.exterior"
              render={({ field }) => (
                <ChoiceGroup label="Außen" value={field.value} onChange={field.onChange} options={EXTERIOR_OPTIONS} />
              )}
            />
            <Controller
              control={form.control}
              name="condition.interior"
              render={({ field }) => (
                <ChoiceGroup label="Innenraum" value={field.value} onChange={field.onChange} options={INTERIOR_OPTIONS} />
              )}
            />
            <Controller
              control={form.control}
              name="condition.fuelLevel"
              render={({ field }) => (
                <ChoiceGroup label="Tankfüllung" value={field.value} onChange={field.onChange} options={FUEL_LEVEL_OPTIONS} />
              )}
            />
          </div>
        </Section>

        <Section title="Folgendes wurde übergeben">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-background p-3">
              <div className="mb-3 flex items-center gap-3">
                <Controller
                  control={form.control}
                  name="items.keys.checked"
                  render={({ field }) => (
                    <Checkbox checked={field.value} onCheckedChange={(value) => field.onChange(value === true)} />
                  )}
                />
                <Label className="cursor-pointer">Fahrzeugschlüssel</Label>
              </div>
              <Controller
                control={form.control}
                name="items.keys.count"
                render={({ field }) => (
                  <TextField
                    label="Anzahl"
                    placeholder="z.B. 2"
                    value={field.value === null || field.value === undefined ? "" : String(field.value)}
                    onChange={(value) => field.onChange(value === "" ? null : Number(value))}
                  />
                )}
              />
            </div>
            {DOCUMENT_CHECKBOXES.map((item) => (
              <Controller
                key={item.name}
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <CheckboxField
                    checked={field.value}
                    label={item.label}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                )}
              />
            ))}
          </div>
          <Separator className="my-4" />
          <Controller
            control={form.control}
            name="items.other"
            render={({ field }) => (
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Sonstiges</Label>
                <Textarea
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Zusätzliche übergebene Gegenstände oder Unterlagen"
                  className="min-h-[96px]"
                />
              </div>
            )}
          />
        </Section>

        <div className="grid gap-6 xl:grid-cols-2">
          <WheelSection title="Montierte Reifen / Felgen" path="mountedWheels" form={form} />
          <WheelSection title="Mit abgegebene Reifen / Felgen" path="includedWheels" form={form} />
        </div>

        <Section title="Beschädigungen" description="Die PDF enthält leere Skizzenflächen für handschriftliche Markierungen im Ausdruck.">
          <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_1fr] md:items-start">
            <Controller
              control={form.control}
              name="damage.photosIncluded"
              render={({ field }) => (
                <CheckboxField
                  checked={field.value}
                  label="Fotos anbei"
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
              )}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Skizze links / vorne
              </div>
              <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Skizze rechts / hinten
              </div>
            </div>
          </div>
        </Section>

        <Section title="Zusatzfelder">
          <div className="grid gap-4">
            <Controller
              control={form.control}
              name="notes.remark"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Bemerkung</Label>
                  <Textarea value={field.value} onChange={field.onChange} className="min-h-[110px]" />
                </div>
              )}
            />
            <Controller
              control={form.control}
              name="notes.additionalInformation"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Zusätzliche Informationen</Label>
                  <Textarea
                    value={field.value}
                    onChange={field.onChange}
                    className="min-h-[120px]"
                    placeholder="Informationen, die der Kunde zusätzlich erhalten hat"
                  />
                </div>
              )}
            />
          </div>
        </Section>
      </div>
    </>
  );

  const footer = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isBusy}>
        Schließen
      </Button>
      <Button variant="outline" onClick={handlePrint} disabled={isBusy || handoverQuery.isLoading}>
        <Printer className="mr-2 h-4 w-4" />
        Drucken
      </Button>
      <Button variant="outline" onClick={handleDownloadPdf} disabled={isBusy || handoverQuery.isLoading}>
        <FileDown className="mr-2 h-4 w-4" />
        PDF herunterladen
      </Button>
      <Button onClick={() => void persistCurrentState()} disabled={isBusy || handoverQuery.isLoading} className="bg-rose-600 hover:bg-rose-700">
        {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Speichern
      </Button>
    </div>
  );

  const headerTitle = "Übergabeprotokoll erstellen";
  const headerDescription = "Bearbeitbar, speicherbar und jederzeit erneut aufrufbar.";

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="flex max-h-[92vh] flex-col">
            <DrawerHeader className="border-b px-4 pb-4">
              <DrawerTitle>{headerTitle}</DrawerTitle>
              <DrawerDescription>{headerDescription}</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {handoverQuery.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                content
              )}
            </div>
            <DrawerFooter className="border-t bg-background/95 backdrop-blur">
              {footer}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col overflow-hidden p-0">
            <DialogHeader className="border-b px-6 py-5">
              <DialogTitle>{headerTitle}</DialogTitle>
              <DialogDescription>{headerDescription}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {handoverQuery.isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                content
              )}
            </div>
            <DialogFooter className="border-t px-6 py-4">{footer}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ungespeicherte Änderungen verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>
              Ihre Änderungen im Übergabeprotokoll sind noch nicht gespeichert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter bearbeiten</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                form.reset(loadedSnapshot);
                setDiscardDialogOpen(false);
                onOpenChange(false);
              }}
            >
              Verwerfen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
