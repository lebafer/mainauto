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
  { name: "items.parkingHeaterRemote" as const, label: "Fernbedienung Standheizung" },
  { name: "items.warningTriangle" as const, label: "Warndreieck" },
  { name: "items.safetyVest" as const, label: "Warnweste" },
  { name: "items.firstAidKit" as const, label: "Verbandkasten" },
] as const;

const VEHICLE_DOCUMENT_CHECKBOXES = [
  { name: "items.registrationPart1" as const, label: "Zulassungsbescheinigung Teil 1" },
  { name: "items.registrationPart2" as const, label: "Zulassungsbescheinigung Teil 2" },
  { name: "items.cocCertificate" as const, label: "COC-Zertifikat" },
] as const;

const WHEEL_CHECKBOXES = [
  { name: "summer" as const, label: "Sommerreifen" },
  { name: "winter" as const, label: "Winterreifen" },
  { name: "allSeason" as const, label: "Ganzjahresreifen" },
  { name: "alloy" as const, label: "Alufelgen" },
  { name: "steel" as const, label: "Stahlfelgen" },
  { name: "spareWheel" as const, label: "Reserverad" },
] as const;

const DAMAGE_VIEWS = [
  { value: "left-front" as const, label: "Skizze links / vorne" },
  { value: "right-rear" as const, label: "Skizze rechts / hinten" },
] as const;

type DamageView = HandoverProtocol["damage"]["markers"][number]["view"];

const WHEEL_CONDITION_OPTIONS = [
  { value: "new", label: "neu" },
  { value: "like_new", label: "neuwertig" },
  { value: "used", label: "gebraucht" },
  { value: "worn", label: "abgefahren" },
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
  columnsClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  columnsClassName?: string;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</Label>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", columnsClassName)}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
              value === option.value
                ? "border-rose-500 bg-rose-50 text-rose-900"
                : "border-border/70 bg-background hover:border-rose-300 hover:bg-rose-50/40"
            )}
          >
            <RadioGroupItem value={option.value} />
            <span className="break-words leading-snug">{option.label}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

function createMarkerId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `marker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function DamageSketchArtwork({ view }: { view: DamageView }) {
  if (view === "left-front") {
    return (
      <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden="true">
        <path d="M10 41 L12 33 L18 29 L27 27 L40 18 L58 13 L72 14 L84 20 L90 30 L89 40 L86 46 L75 46 L71 39 L40 39 L33 46 L21 46 L16 41 Z" className="fill-slate-50 stroke-slate-400" strokeWidth="1.2" />
        <path d="M27 27 L44 15 L67 15 L78 22 L82 30" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
        <path d="M41 18 L55 19 L66 25 L67 39" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
        <path d="M55 19 L53 39" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
        <path d="M18 31 L31 32" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
        <path d="M70 25 L89 28" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
        <path d="M24 39 L10 41" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
        <path d="M13 35 L20 35" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
        <path d="M69 31 L87 33" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
        <path d="M44 15 L50 11 L61 11 L67 14" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
        <circle cx="27" cy="46" r="8" className="fill-white stroke-slate-400" strokeWidth="1.2" />
        <circle cx="74" cy="46" r="8" className="fill-white stroke-slate-400" strokeWidth="1.2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden="true">
      <path d="M12 41 L11 31 L19 28 L28 18 L43 14 L60 15 L72 21 L84 23 L90 32 L89 42 L82 47 L68 47 L62 39 L29 39 L24 47 L13 47 Z" className="fill-slate-50 stroke-slate-400" strokeWidth="1.2" />
      <path d="M28 19 L42 10 L56 10 L69 17 L74 24" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
      <path d="M22 27 L39 30 L56 30 L73 26" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
      <path d="M45 15 L42 30" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
      <path d="M59 17 L58 39" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
      <path d="M14 35 L11 41" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
      <path d="M76 24 L88 26" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
      <path d="M18 28 L14 23" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
      <path d="M48 13 L51 9 L61 9 L66 12" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
      <path d="M12 34 L20 34" className="fill-none stroke-slate-400" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
      <circle cx="29" cy="47" r="8" className="fill-white stroke-slate-400" strokeWidth="1.2" />
      <circle cx="74" cy="47" r="8" className="fill-white stroke-slate-400" strokeWidth="1.2" />
    </svg>
  );
}

function DamageSketch({
  view,
  label,
  markers,
  onAddMarker,
  onRemoveMarker,
}: {
  view: DamageView;
  label: string;
  markers: HandoverProtocol["damage"]["markers"];
  onAddMarker: (view: DamageView, x: number, y: number) => void;
  onRemoveMarker: (id: string) => void;
}) {
  const viewMarkers = markers.filter((marker) => marker.view === view);

  function handleSketchClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    onAddMarker(view, Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div
        onClick={handleSketchClick}
        className="relative aspect-[5/3] w-full cursor-crosshair overflow-hidden rounded-2xl border border-border/70 bg-muted/20 p-4 transition-colors hover:border-rose-300 hover:bg-rose-50/20"
      >
        <DamageSketchArtwork view={view} />
        {viewMarkers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            className="absolute h-4 w-4 rounded-full border-2 border-rose-700 bg-rose-500/20 shadow-sm"
            style={{
              left: `${marker.x}%`,
              top: `${marker.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            onClick={(event) => {
              event.stopPropagation();
              onRemoveMarker(marker.id);
            }}
            aria-label="Schadensmarker entfernen"
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Klick setzt einen Marker. Klick auf einen Marker entfernt ihn.</p>
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
      <Controller
        control={form.control}
        name={`${path}.condition`}
        render={({ field }) => (
          <ChoiceGroup
            label="Zustand"
            value={field.value}
            onChange={field.onChange}
            options={WHEEL_CONDITION_OPTIONS}
            columnsClassName="md:grid-cols-2"
          />
        )}
      />
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

  function addDamageMarker(view: DamageView, x: number, y: number) {
    form.setValue(
      "damage.markers",
      [...protocol.damage.markers, { id: createMarkerId(), view, x, y }],
      { shouldDirty: true }
    );
  }

  function removeDamageMarker(id: string) {
    form.setValue(
      "damage.markers",
      protocol.damage.markers.filter((marker) => marker.id !== id),
      { shouldDirty: true }
    );
  }

  const protocol = form.watch();

  const content = (
    <>
      <div className="space-y-6 px-1">
        <Section
          title="Fahrzeugdaten"
          description="Die interne Fahrzeugnummer und VIN werden automatisch übernommen, bleiben aber editierbar."
        >
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 text-sm text-foreground">
            <CarFront className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium">Interne Fahrzeugnummer: {protocol.vehicle.internalVehicleNumber || vehicle.vehicleNumber}</div>
              <div className="text-xs text-muted-foreground">VIN: {protocol.vehicle.vin || vehicle.vin || "nicht hinterlegt"}</div>
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
              label="Kraftstoffart"
              value={protocol.vehicle.fuelType}
              onChange={(value) => form.setValue("vehicle.fuelType", value, { shouldDirty: true })}
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
          <div className="grid gap-4 lg:grid-cols-3">
            <Controller
              control={form.control}
              name="condition.exterior"
              render={({ field }) => (
                <ChoiceGroup
                  label="Außen"
                  value={field.value}
                  onChange={field.onChange}
                  options={EXTERIOR_OPTIONS}
                  columnsClassName="lg:grid-cols-1"
                />
              )}
            />
            <Controller
              control={form.control}
              name="condition.interior"
              render={({ field }) => (
                <ChoiceGroup
                  label="Innenraum"
                  value={field.value}
                  onChange={field.onChange}
                  options={INTERIOR_OPTIONS}
                  columnsClassName="lg:grid-cols-1"
                />
              )}
            />
            <Controller
              control={form.control}
              name="condition.fuelLevel"
              render={({ field }) => (
                <ChoiceGroup
                  label="Tankfüllung"
                  value={field.value}
                  onChange={field.onChange}
                  options={FUEL_LEVEL_OPTIONS}
                  columnsClassName="lg:grid-cols-2"
                />
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
            <div className="grid gap-3">
              {VEHICLE_DOCUMENT_CHECKBOXES.map((item) => (
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

        <Section title="Beschädigungen" description="Klick auf eine Skizze setzt einen Marker. Ein Klick auf einen bestehenden Marker entfernt ihn wieder.">
          <div className="grid gap-4 xl:grid-cols-2">
            {DAMAGE_VIEWS.map((view) => (
              <DamageSketch
                key={view.value}
                view={view.value}
                label={view.label}
                markers={protocol.damage.markers}
                onAddMarker={addDamageMarker}
                onRemoveMarker={removeDamageMarker}
              />
            ))}
          </div>
          <Separator className="my-4" />
          <Controller
            control={form.control}
            name="damage.remark"
            render={({ field }) => (
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Bemerkung zu Beschädigungen</Label>
                <Textarea
                  value={field.value}
                  onChange={field.onChange}
                  className="min-h-[120px]"
                  placeholder="Beschreiben Sie hier die markierten Beschädigungen"
                />
              </div>
            )}
          />
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
