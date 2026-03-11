import { useState, useEffect, type ChangeEvent } from "react";
import { useForm, type FieldErrors, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Loader2, PlusCircle, X, Check, ChevronsUpDown, FileSearch } from "lucide-react";
import { QuickAddSupplierDialog } from "@/components/suppliers/QuickAddSupplierDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  VehicleBriefExtractResponseSchema,
  type VehicleBriefExtractFields,
} from "../../../../backend/src/types";
import {
  type Vehicle,
  FUEL_TYPES,
  TRANSMISSIONS,
  BODY_TYPES,
  DRIVE_TYPES,
  EMISSION_CLASSES,
  STATUS_OPTIONS,
  calculateGrossPrice,
  calculateNetPrice,
  formatPrice,
  featuresToJson,
  getVehicleManualCostsTotal,
  parseFeatures,
} from "@/lib/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const DEFAULT_MANUFACTURERS = [
  "Mercedes-Benz",
  "BMW",
  "Audi",
  "Volkswagen",
  "Porsche",
  "Opel",
  "Ford",
  "Tesla",
  "BYD",
];

const CAR_COLORS = [
  "Schwarz",
  "Schwarz Metallic",
  "Weiß",
  "Weiß Perleffekt",
  "Silber",
  "Silber Metallic",
  "Grau",
  "Grau Metallic",
  "Dunkelgrau Metallic",
  "Blau",
  "Blau Metallic",
  "Navarra Blau",
  "Dunkelblau",
  "Dunkelblau Metallic",
  "Rot",
  "Rot Metallic",
  "Tornadorot",
  "Dunkelrot",
  "Braun",
  "Braun Metallic",
  "Beige",
  "Champagner",
  "Grün",
  "Grün Metallic",
  "Olivgrün",
  "Orange",
  "Orange Metallic",
  "Gelb",
  "Gold Metallic",
  "Kreidefarben",
  "Sonstige",
];

const DEFAULT_CONNECTOR_TYPES = [
  "CCS",
  "CHAdeMO",
  "Type 2",
  "Type 1",
  "GB/T",
  "Tesla Supercharger",
];

const REQUIRED_VEHICLE_FIELDS = ["vehicleNumber", "brand", "model", "mileage", "purchasePrice", "sellingPrice"] as const;
const REQUIRED_VEHICLE_FIELD_LABELS: Record<(typeof REQUIRED_VEHICLE_FIELDS)[number], string> = {
  vehicleNumber: "Interne Nummer",
  brand: "Hersteller / Marke",
  model: "Modell",
  mileage: "Kilometerstand",
  purchasePrice: "Einkaufspreis",
  sellingPrice: "Verkaufspreis",
};

const BRIEF_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const BRIEF_MAX_FILES = 4;
const BRIEF_PREFILL_FIELDS: Array<keyof VehicleBriefExtractFields> = [
  "vin",
  "firstRegistration",
  "color",
  "brand",
  "model",
  "hsn",
  "tsn",
  "registrationDocNumber",
  "fuelType",
  "co2Emission",
  "displacement",
  "power",
  "powerKw",
  "bodyType",
  "driveType",
  "emissionClass",
  "previousOwners",
];

function RequiredMark() {
  return <span className="ml-1 text-destructive">*</span>;
}

function requiredNonNegativeNumber(label: string) {
  return z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) {
        return undefined;
      }
      if (typeof value === "number") {
        return Number.isNaN(value) ? undefined : value;
      }
      if (typeof value === "string") {
        const normalized = value.replace(",", ".");
        const parsed = Number(normalized);
        return Number.isNaN(parsed) ? undefined : parsed;
      }
      return value;
    },
    z
      .number({
        required_error: `${label} ist erforderlich`,
        invalid_type_error: `${label} ist erforderlich`,
      })
      .min(0, `${label} muss positiv sein`)
  );
}

function isFormFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return Number.isNaN(value);
  return false;
}

const vehicleFormSchema = z.object({
  vehicleNumber: z.string().trim().min(1, "Interne Nummer ist erforderlich"),
  brand: z.string().min(1, "Marke ist erforderlich"),
  model: z.string().min(1, "Modell ist erforderlich"),
  firstRegistration: z.string().optional().default(""),
  mileage: requiredNonNegativeNumber("Kilometerstand"),
  vin: z.string()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || (v.length === 17 && /^[A-Z0-9]{17}$/.test(v)), {
      message: "VIN muss genau 17 Zeichen haben (nur Buchstaben und Zahlen)",
    })
    .optional()
    .default(""),
  hsn: z.string().optional().default(""),
  tsn: z.string().optional().default(""),
  registrationDocNumber: z.string().optional().default(""),
  color: z.string().optional().default(""),
  fuelType: z.string().optional().default(""),
  transmission: z.string().optional().default(""),
  power: z.coerce.number().min(0).optional(),
  features: z.string().optional().default(""),
  purchasePrice: requiredNonNegativeNumber("Einkaufspreis"),
  sellingPrice: requiredNonNegativeNumber("Verkaufspreis"),
  taxRate: z.coerce.number().min(0).max(100).default(19),
  marginTaxed: z.boolean().default(false),
  status: z.string().default("available"),
  notes: z.string().optional().default(""),
  internalNotes: z.string().optional().default(""),
  customerId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  // History & Maintenance
  huDue: z.string().optional().default(""),
  previousOwners: z.coerce.number().int().min(0).optional(),
  serviceDueKm: z.coerce.number().int().optional(),
  serviceDueDate: z.string().optional().default(""),
  // Technical
  co2Emission: z.coerce.number().optional(),
  displacement: z.coerce.number().int().optional(),
  powerKw: z.coerce.number().optional(),
  // Technical extras
  bodyType: z.string().optional().default(""),
  doors: z.coerce.number().int().min(0).optional(),
  seats: z.coerce.number().int().min(0).optional(),
  driveType: z.string().optional().default(""),
  emissionClass: z.string().optional().default(""),
  // Damage
  hasDamage: z.boolean().default(false),
  damageDescription: z.string().optional().default(""),
  damageAmount: z.coerce.number().optional(),
  // Hybrid/Electric
  batteryCapacity: z.coerce.number().optional(),
  electricRange: z.coerce.number().int().optional(),
  batterySoh: z.coerce.number().optional(),
  batteryType: z.string().optional().default(""),
  chargingTime: z.coerce.number().int().optional(),
  connectorType: z.string().optional().default(""),
  // Export
  exportEnabled: z.boolean().default(false),
  transportCostDomestic: z.coerce.number().optional(),
  transportCostAbroad: z.coerce.number().optional(),
  customsDuties: z.coerce.number().optional(),
  registrationFees: z.coerce.number().optional(),
  repairCostsAbroad: z.coerce.number().optional(),
  // Pricing extras
  dealerPrice: z.coerce.number().min(0).optional(),
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

export type VehicleFormSubmitValues = Omit<
  VehicleFormValues,
  "power" | "vin" | "hsn" | "tsn" | "registrationDocNumber" | "color" | "fuelType" | "transmission" | "notes" | "internalNotes" | "customerId" | "damageDescription" | "batteryType" | "connectorType" | "supplierId" | "huDue" | "previousOwners" | "serviceDueKm" | "serviceDueDate"
> & {
  power?: number;
  vin?: string;
  hsn?: string;
  tsn?: string;
  registrationDocNumber?: string;
  color?: string;
  fuelType?: string;
  transmission?: string;
  notes?: string;
  internalNotes?: string;
  customerId?: null;
  damageDescription?: string;
  batteryType?: string;
  connectorType?: string;
  chargingTime?: number;
  supplierId?: string | null;
  huDue?: string;
  previousOwners?: number;
  serviceDueKm?: number;
  serviceDueDate?: string;
};

interface VehicleFormProps {
  defaultValues?: Partial<VehicleFormValues>;
  vehicle?: Vehicle;
  onSubmit: (values: VehicleFormSubmitValues) => void;
  isSubmitting: boolean;
  submitLabel: string;
  onExtractedBriefFiles?: (files: File[]) => void;
}

export function VehicleForm({
  defaultValues,
  vehicle,
  onSubmit,
  isSubmitting,
  submitLabel,
  onExtractedBriefFiles,
}: VehicleFormProps) {
  const [priceInputMode, setPriceInputMode] = useState<"netto" | "brutto">("netto");
  const [grossDisplay, setGrossDisplay] = useState("");
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandInput, setNewBrandInput] = useState("");
  const [showAddColor, setShowAddColor] = useState(false);
  const [newColorInput, setNewColorInput] = useState("");
  const [showAddConnector, setShowAddConnector] = useState(false);
  const [newConnectorInput, setNewConnectorInput] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [supplierDbOpen, setSupplierDbOpen] = useState(false);
  const [quickAddSupplierOpen, setQuickAddSupplierOpen] = useState(false);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [briefFiles, setBriefFiles] = useState<File[]>([]);
  const [briefResult, setBriefResult] = useState<{
    detectedFieldCount: number;
    applied: number;
    skipped: number;
    savedDocuments: number;
    warnings: string[];
  } | null>(null);

  const initialValues: Partial<VehicleFormValues> = {
    vehicleNumber: vehicle?.vehicleNumber ?? defaultValues?.vehicleNumber ?? "",
    brand: vehicle?.brand ?? defaultValues?.brand ?? "",
    model: vehicle?.model ?? defaultValues?.model ?? "",
    firstRegistration: vehicle?.firstRegistration
      ? new Date(vehicle.firstRegistration).toISOString().split("T")[0]
      : defaultValues?.firstRegistration ?? "",
    mileage: vehicle?.mileage ?? defaultValues?.mileage,
    vin: vehicle?.vin ?? defaultValues?.vin ?? "",
    hsn: vehicle?.hsn ?? defaultValues?.hsn ?? "",
    tsn: vehicle?.tsn ?? defaultValues?.tsn ?? "",
    registrationDocNumber: vehicle?.registrationDocNumber ?? defaultValues?.registrationDocNumber ?? "",
    color: vehicle?.color ?? defaultValues?.color ?? "",
    fuelType: vehicle?.fuelType ?? defaultValues?.fuelType ?? "",
    transmission: vehicle?.transmission ?? defaultValues?.transmission ?? "",
    power: vehicle?.power ?? defaultValues?.power,
    features: vehicle
      ? parseFeatures(vehicle.features).join(", ")
      : defaultValues?.features ?? "",
    purchasePrice: vehicle?.purchasePrice ?? defaultValues?.purchasePrice,
    sellingPrice: vehicle?.sellingPrice ?? defaultValues?.sellingPrice,
    taxRate: vehicle?.taxRate ?? defaultValues?.taxRate ?? 19,
    marginTaxed: vehicle?.marginTaxed ?? defaultValues?.marginTaxed ?? false,
    status: vehicle?.status ?? defaultValues?.status ?? "available",
    notes: vehicle?.notes ?? defaultValues?.notes ?? "",
    internalNotes: vehicle?.internalNotes ?? defaultValues?.internalNotes ?? "",
    customerId: vehicle?.customerId ?? defaultValues?.customerId ?? null,
    supplierId: vehicle?.supplierId ?? defaultValues?.supplierId ?? null,
    // History & Maintenance
    huDue: vehicle?.huDue ? new Date(vehicle.huDue).toISOString().slice(0, 7) : defaultValues?.huDue ?? "",
    previousOwners: vehicle?.previousOwners ?? defaultValues?.previousOwners ?? undefined,
    serviceDueKm: vehicle?.serviceDueKm ?? defaultValues?.serviceDueKm ?? undefined,
    serviceDueDate: vehicle?.serviceDueDate ? new Date(vehicle.serviceDueDate).toISOString().split("T")[0] : defaultValues?.serviceDueDate ?? "",
    // Technical
    co2Emission: vehicle?.co2Emission ?? defaultValues?.co2Emission ?? undefined,
    displacement: vehicle?.displacement ?? defaultValues?.displacement ?? undefined,
    powerKw: vehicle?.powerKw ?? defaultValues?.powerKw ?? undefined,
    // Technical extras
    bodyType: vehicle?.bodyType ?? defaultValues?.bodyType ?? "",
    doors: vehicle?.doors ?? defaultValues?.doors ?? undefined,
    seats: vehicle?.seats ?? defaultValues?.seats ?? undefined,
    driveType: vehicle?.driveType ?? defaultValues?.driveType ?? "",
    emissionClass: vehicle?.emissionClass ?? defaultValues?.emissionClass ?? "",
    // Damage
    hasDamage: vehicle?.hasDamage ?? defaultValues?.hasDamage ?? false,
    damageDescription: vehicle?.damageDescription ?? defaultValues?.damageDescription ?? "",
    damageAmount: vehicle?.damageAmount ?? defaultValues?.damageAmount ?? undefined,
    // Pricing extras
    dealerPrice: vehicle?.dealerPrice ?? defaultValues?.dealerPrice ?? undefined,
    // Hybrid/Electric
    batteryCapacity: vehicle?.batteryCapacity ?? defaultValues?.batteryCapacity ?? undefined,
    electricRange: vehicle?.electricRange ?? defaultValues?.electricRange ?? undefined,
    batterySoh: vehicle?.batterySoh ?? defaultValues?.batterySoh ?? undefined,
    batteryType: vehicle?.batteryType ?? defaultValues?.batteryType ?? "",
    chargingTime: vehicle?.chargingTime ?? defaultValues?.chargingTime ?? undefined,
    connectorType: vehicle?.connectorType ?? defaultValues?.connectorType ?? "",
    // Export
    exportEnabled: vehicle?.exportEnabled ?? defaultValues?.exportEnabled ?? false,
    transportCostDomestic: vehicle?.transportCostDomestic ?? defaultValues?.transportCostDomestic ?? undefined,
    transportCostAbroad: vehicle?.transportCostAbroad ?? defaultValues?.transportCostAbroad ?? undefined,
    customsDuties: vehicle?.customsDuties ?? defaultValues?.customsDuties ?? undefined,
    registrationFees: vehicle?.registrationFees ?? defaultValues?.registrationFees ?? undefined,
    repairCostsAbroad: vehicle?.repairCostsAbroad ?? defaultValues?.repairCostsAbroad ?? undefined,
  };

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: initialValues,
  });

  const queryClient = useQueryClient();

  // Brands
  const { data: customBrands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: () => api.get<string[]>("/api/brands"),
  });

  const allBrands = [...new Set([...DEFAULT_MANUFACTURERS, ...customBrands])].sort((a, b) => {
    const aIsDefault = DEFAULT_MANUFACTURERS.includes(a);
    const bIsDefault = DEFAULT_MANUFACTURERS.includes(b);
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;
    return a.localeCompare(b);
  });

  const addBrandMutation = useMutation({
    mutationFn: (name: string) => api.post<string>("/api/brands", { name }),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      form.setValue("brand", name.trim());
      setShowAddBrand(false);
      setNewBrandInput("");
    },
  });

  function handleAddBrand() {
    if (newBrandInput.trim()) {
      addBrandMutation.mutate(newBrandInput.trim());
    }
  }

  // Colors
  const { data: customColors = [] } = useQuery({
    queryKey: ["colors"],
    queryFn: () => api.get<string[]>("/api/colors"),
  });

  const allColors = [...new Set([...CAR_COLORS, ...customColors])].sort((a, b) => {
    const aIs = CAR_COLORS.includes(a);
    const bIs = CAR_COLORS.includes(b);
    if (aIs && !bIs) return -1;
    if (!aIs && bIs) return 1;
    return a.localeCompare(b);
  });

  const addColorMutation = useMutation({
    mutationFn: (name: string) => api.post<string>("/api/colors", { name }),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ["colors"] });
      form.setValue("color", name.trim());
      setShowAddColor(false);
      setNewColorInput("");
    },
  });

  function handleAddColor() {
    if (newColorInput.trim()) {
      addColorMutation.mutate(newColorInput.trim());
    }
  }

  // Suppliers DB (linked supplier records)
  const { data: suppliersDb = [] } = useQuery({
    queryKey: ["suppliers-db"],
    queryFn: () => api.get<{ id: string; name: string; supplierType: string; contactPerson?: string | null }[]>("/api/suppliers-db"),
  });

  // Connector types
  const { data: customConnectors = [] } = useQuery({
    queryKey: ["connectorTypes"],
    queryFn: () => api.get<string[]>("/api/connector-types"),
  });

  const allConnectors = [...new Set([...DEFAULT_CONNECTOR_TYPES, ...customConnectors])].sort((a, b) => {
    const aIs = DEFAULT_CONNECTOR_TYPES.includes(a);
    const bIs = DEFAULT_CONNECTOR_TYPES.includes(b);
    if (aIs && !bIs) return -1;
    if (!aIs && bIs) return 1;
    return a.localeCompare(b);
  });

  const addConnectorMutation = useMutation({
    mutationFn: (name: string) => api.post<string>("/api/connector-types", { name }),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ["connectorTypes"] });
      form.setValue("connectorType", name.trim());
      setShowAddConnector(false);
      setNewConnectorInput("");
    },
  });

  function handleAddConnector() {
    if (newConnectorInput.trim()) {
      addConnectorMutation.mutate(newConnectorInput.trim());
    }
  }

  function applyExtractedFields(fields: VehicleBriefExtractFields) {
    let applied = 0;
    let skipped = 0;

    for (const field of BRIEF_PREFILL_FIELDS) {
      const nextValue = fields[field];
      if (nextValue === undefined || nextValue === null) continue;

      const currentValue = form.getValues(field as keyof VehicleFormValues);
      if (isFormFieldEmpty(currentValue)) {
        form.setValue(field as Path<VehicleFormValues>, nextValue as never, {
          shouldDirty: true,
          shouldValidate: true,
        });
        applied += 1;
      } else {
        skipped += 1;
      }
    }

    return { applied, skipped };
  }

  async function uploadBriefDocuments(vehicleId: string, files: File[]): Promise<number> {
    let uploaded = 0;

    for (const [index, file] of files.entries()) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", files.length === 1 ? "Fahrzeugbrief" : `Fahrzeugbrief ${index + 1}`);

      const response = await api.raw(`/api/vehicles/${vehicleId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || "Dokument konnte nicht gespeichert werden");
      }

      uploaded += 1;
    }

    return uploaded;
  }

  const extractBriefMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await api.raw("/api/vehicles/extract-brief", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || "Extraktion fehlgeschlagen");
      }

      const json = await response.json();
      return VehicleBriefExtractResponseSchema.parse(json.data);
    },
    onSuccess: async (result, files) => {
      const warnings = [...result.warnings];
      const { applied, skipped } = applyExtractedFields(result.fields);
      let savedDocuments = 0;

      if (vehicle?.id) {
        try {
          savedDocuments = await uploadBriefDocuments(vehicle.id, files);
          queryClient.invalidateQueries({ queryKey: ["vehicle", vehicle.id] });
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : "Fahrzeugbrief konnte nicht gespeichert werden");
        }
      } else {
        onExtractedBriefFiles?.(files);
      }

      setBriefResult({
        detectedFieldCount: result.detectedFieldCount,
        applied,
        skipped,
        savedDocuments,
        warnings,
      });
    },
    onError: (error: unknown) => {
      onExtractedBriefFiles?.([]);
      setBriefResult({
        detectedFieldCount: 0,
        applied: 0,
        skipped: 0,
        savedDocuments: 0,
        warnings: [error instanceof Error ? error.message : "Extraktion fehlgeschlagen"],
      });
    },
  });

  const watchedSellingPrice = form.watch("sellingPrice") ?? 0;
  const watchedTaxRate = form.watch("taxRate") ?? 19;
  const watchedMarginTaxed = form.watch("marginTaxed") ?? false;
  const watchedPurchasePrice = form.watch("purchasePrice") ?? 0;
  const watchedFuelType = form.watch("fuelType");
  const watchedHasDamage = form.watch("hasDamage");
  const watchedExportEnabled = form.watch("exportEnabled");
  const watchedTransportCostAbroad = form.watch("transportCostAbroad");
  const watchedCustomsDuties = form.watch("customsDuties");
  const watchedRegistrationFees = form.watch("registrationFees");
  const watchedRepairCostsAbroad = form.watch("repairCostsAbroad");
  const watchedTransportCostDomestic = form.watch("transportCostDomestic");

  const isElectricOrHybrid =
    watchedFuelType === "Elektro" || watchedFuelType === "Hybrid";

  const exportTotal =
    (watchedTransportCostDomestic ?? 0) +
    (watchedTransportCostAbroad ?? 0) +
    (watchedCustomsDuties ?? 0) +
    (watchedRegistrationFees ?? 0) +
    (watchedRepairCostsAbroad ?? 0);
  const domesticTransportCost = watchedTransportCostDomestic ?? 0;
  const exportOnlyCosts =
    (watchedTransportCostAbroad ?? 0) +
    (watchedCustomsDuties ?? 0) +
    (watchedRegistrationFees ?? 0) +
    (watchedRepairCostsAbroad ?? 0);

  // Keep gross display in sync with selling price changes
  useEffect(() => {
    if (priceInputMode === "netto") {
      const gross = calculateGrossPrice(watchedSellingPrice, watchedTaxRate, watchedMarginTaxed);
      setGrossDisplay(gross.toFixed(2));
    }
  }, [watchedSellingPrice, watchedTaxRate, watchedMarginTaxed, priceInputMode]);

  // Initialize gross display
  useEffect(() => {
    const gross = calculateGrossPrice(
      initialValues.sellingPrice ?? 0,
      initialValues.taxRate ?? 19,
      initialValues.marginTaxed ?? false
    );
    setGrossDisplay(gross.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGrossChange(grossStr: string) {
    setGrossDisplay(grossStr);
    if (grossStr.trim() === "") {
      form.setValue("sellingPrice", "" as unknown as number, { shouldValidate: true });
      return;
    }
    const grossVal = parseFloat(grossStr.replace(",", "."));
    if (Number.isNaN(grossVal)) {
      return;
    }
    const netVal = calculateNetPrice(grossVal, watchedTaxRate, watchedMarginTaxed);
    form.setValue("sellingPrice", Math.round(netVal * 100) / 100);
  }

  function handleNettoChange(nettoStr: string) {
    if (nettoStr.trim() === "") {
      form.setValue("sellingPrice", "" as unknown as number, { shouldValidate: true });
      return;
    }
    const netVal = parseFloat(nettoStr.replace(",", "."));
    if (Number.isNaN(netVal)) {
      return;
    }
    form.setValue("sellingPrice", netVal);
  }

  // PS <-> kW auto-calculation
  function handlePsChange(val: string) {
    const ps = parseFloat(val) || 0;
    form.setValue("power", ps);
    form.setValue("powerKw", Math.round(ps / 1.35962));
  }

  function handleKwChange(val: string) {
    const kw = parseFloat(val) || 0;
    form.setValue("powerKw", kw);
    form.setValue("power", Math.round(kw * 1.35962));
  }

  function handleBriefFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).slice(0, BRIEF_MAX_FILES);
    setBriefFiles(selected);
    setBriefResult(null);
  }

  function handleBriefExtraction() {
    if (briefFiles.length === 0 || extractBriefMutation.isPending) return;
    setBriefResult(null);
    extractBriefMutation.mutate(briefFiles);
  }

  function handleSubmit(values: VehicleFormValues) {
    const processed: VehicleFormSubmitValues = {
      ...values,
      features: featuresToJson(values.features ?? ""),
      customerId: undefined,
      power: values.power ?? undefined,
      vin: values.vin || undefined,
      hsn: values.hsn || undefined,
      tsn: values.tsn || undefined,
      registrationDocNumber: values.registrationDocNumber || undefined,
      color: values.color || undefined,
      fuelType: values.fuelType || undefined,
      transmission: values.transmission || undefined,
      notes: values.notes || undefined,
      internalNotes: values.internalNotes || undefined,
      // Supplier relation
      supplierId: values.supplierId || null,
      // History & Maintenance
      huDue: values.huDue ? values.huDue + "-01" : undefined,
      previousOwners: values.previousOwners,
      serviceDueKm: values.serviceDueKm,
      serviceDueDate: values.serviceDueDate || undefined,
      // Technical
      co2Emission: values.co2Emission ?? undefined,
      displacement: values.displacement ?? undefined,
      powerKw: values.powerKw ?? undefined,
      // Damage
      hasDamage: values.hasDamage,
      damageDescription: values.damageDescription || undefined,
      damageAmount: values.damageAmount || undefined,
      // Hybrid/Electric
      batteryCapacity: values.batteryCapacity || undefined,
      electricRange: values.electricRange || undefined,
      batterySoh: values.batterySoh || undefined,
      batteryType: values.batteryType || undefined,
      chargingTime: values.chargingTime || undefined,
      connectorType: values.connectorType || undefined,
      // Export
      exportEnabled: values.exportEnabled,
      transportCostDomestic: values.transportCostDomestic ?? undefined,
      transportCostAbroad: values.transportCostAbroad ?? undefined,
      customsDuties: values.customsDuties ?? undefined,
      registrationFees: values.registrationFees ?? undefined,
      repairCostsAbroad: values.repairCostsAbroad ?? undefined,
    };
    onSubmit(processed);
  }

  function handleInvalidSubmit(errors: FieldErrors<VehicleFormValues>) {
    const firstErrorField = Object.keys(errors)[0] as Path<VehicleFormValues> | undefined;
    if (firstErrorField) {
      form.setFocus(firstErrorField);
    }
  }

  const existingAdditionalCosts = vehicle ? getVehicleManualCostsTotal(vehicle) : 0;
  const totalAdditionalCosts =
    domesticTransportCost +
    (watchedExportEnabled ? exportOnlyCosts : 0) +
    existingAdditionalCosts;
  const margin = watchedSellingPrice - watchedPurchasePrice - totalAdditionalCosts;
  const grossPrice = calculateGrossPrice(watchedSellingPrice, watchedTaxRate, watchedMarginTaxed);
  const requiredFieldErrors = REQUIRED_VEHICLE_FIELDS.filter((field) => Boolean(form.formState.errors[field]));
  const sellingPriceHasError = Boolean(form.formState.errors.sellingPrice);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)} className="space-y-6">
        <p className="text-xs text-muted-foreground">* Pflichtfeld</p>
        {form.formState.submitCount > 0 && requiredFieldErrors.length > 0 ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Bitte Pflichtfelder ausfüllen:{" "}
            {requiredFieldErrors.map((field) => REQUIRED_VEHICLE_FIELD_LABELS[field]).join(", ")}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fahrzeugbrief analysieren (PDF/Bild)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="vehicle-brief-upload">Dateien hochladen (max. 4)</Label>
                <Input
                  id="vehicle-brief-upload"
                  type="file"
                  accept={BRIEF_ACCEPT}
                  multiple
                  onChange={handleBriefFilesChange}
                />
                <p className="text-xs text-muted-foreground">
                  Unterstützt: PDF, JPG, PNG, WEBP. Bereits ausgefüllte Felder werden nicht überschrieben.
                </p>
                {briefFiles.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Ausgewählt: {briefFiles.map((file) => file.name).join(", ")}
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                onClick={handleBriefExtraction}
                disabled={briefFiles.length === 0 || extractBriefMutation.isPending}
              >
                {extractBriefMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSearch className="mr-2 h-4 w-4" />
                )}
                Daten extrahieren
              </Button>
            </div>

            {briefResult ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm space-y-1">
                <p>
                  Erkannt: {briefResult.detectedFieldCount} · Übernommen: {briefResult.applied} · Übersprungen: {briefResult.skipped}
                </p>
                {briefResult.savedDocuments > 0 ? (
                  <p>Als Dokument gespeichert: {briefResult.savedDocuments}</p>
                ) : null}
                {briefResult.warnings.length > 0 ? (
                  <p className="text-destructive">
                    {briefResult.warnings.join(" ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Section 1: Fahrzeugdaten */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fahrzeugdaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Brand Section */}
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Hersteller / Marke
                      <RequiredMark />
                    </FormLabel>
                    <Popover open={brandOpen} onOpenChange={setBrandOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={brandOpen}
                            className="w-full justify-between font-normal"
                          >
                            {field.value ? field.value : "Marke auswählen..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                        <Command>
                          <CommandInput placeholder="Suchen..." />
                          <CommandList>
                            <CommandEmpty>Keine Ergebnisse</CommandEmpty>
                            <CommandGroup>
                              {allBrands.map((b) => (
                                <CommandItem
                                  key={b}
                                  value={b}
                                  onSelect={(val) => {
                                    field.onChange(val);
                                    setBrandOpen(false);
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${field.value === b ? "opacity-100" : "opacity-0"}`} />
                                  {b}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <CommandGroup>
                              <CommandItem
                                value="__add_new__"
                                onSelect={() => { setShowAddBrand(true); setBrandOpen(false); }}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" /> Neue Marke hinzufügen
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Inline add brand form */}
              {showAddBrand ? (
                <div className="flex gap-2 items-center rounded-lg border bg-muted/40 p-3">
                  <Input
                    placeholder="z.B. Skoda"
                    value={newBrandInput}
                    onChange={(e) => setNewBrandInput(e.target.value)}
                    className="h-8 text-sm flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddBrand(); } }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={!newBrandInput.trim() || addBrandMutation.isPending}
                    onClick={handleAddBrand}
                  >
                    {addBrandMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Hinzufügen"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => { setShowAddBrand(false); setNewBrandInput(""); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="vehicleNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Interne Nummer
                      <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. FZ-2026-00001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Modell
                      <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. 320d" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="firstRegistration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Erstzulassung</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Kilometerstand
                      <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? ("" as unknown as number) : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fahrgestellnummer (VIN)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. WBA3A5C50CF256651"
                        maxLength={17}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                        className={field.value && field.value.length > 0 && field.value.length < 17 ? "border-red-500 focus-visible:ring-red-500" : ""}
                      />
                    </FormControl>
                    {field.value && field.value.length > 0 && field.value.length < 17 ? (
                      <p className="text-xs text-muted-foreground">{field.value.length}/17 Zeichen</p>
                    ) : field.value && field.value.length === 17 ? (
                      <p className="text-xs text-emerald-500">✓ 17/17 Zeichen</p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hsn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Herstellerschlüsselnummer (HSN)</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. 0005" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tsn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typschlüsselnummer (TSN)</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. ABC123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registrationDocNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fahrzeugbrief-Nr.</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. BRIEF-123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Color dropdown */}
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Farbe</FormLabel>
                      <Popover open={colorOpen} onOpenChange={setColorOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={colorOpen}
                              className="w-full justify-between font-normal"
                            >
                              {field.value ? field.value : "Farbe auswählen..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                          <Command>
                            <CommandInput placeholder="Suchen..." />
                            <CommandList>
                              <CommandEmpty>Keine Ergebnisse</CommandEmpty>
                              <CommandGroup>
                                {allColors.map((c) => (
                                  <CommandItem
                                    key={c}
                                    value={c}
                                    onSelect={(val) => {
                                      field.onChange(val);
                                      setColorOpen(false);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${field.value === c ? "opacity-100" : "opacity-0"}`} />
                                    {c}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandGroup>
                                <CommandItem
                                  value="__add_new__"
                                  onSelect={() => { setShowAddColor(true); setColorOpen(false); }}
                                >
                                  <PlusCircle className="mr-2 h-4 w-4" /> Eigene Farbe hinzufügen
                                </CommandItem>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {showAddColor ? (
                  <div className="flex gap-2 items-center rounded-lg border bg-muted/40 p-3">
                    <Input
                      placeholder="z.B. Kreidefarben Matt"
                      value={newColorInput}
                      onChange={(e) => setNewColorInput(e.target.value)}
                      className="h-8 text-sm flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddColor(); } }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      disabled={!newColorInput.trim() || addColorMutation.isPending}
                      onClick={handleAddColor}
                    >
                      {addColorMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Hinzufügen"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => { setShowAddColor(false); setNewColorInput(""); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>

              {/* Lieferant (aus Lieferantendatenbank) */}
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lieferant</FormLabel>
                    <Popover open={supplierDbOpen} onOpenChange={setSupplierDbOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={supplierDbOpen}
                            className="w-full justify-between font-normal"
                          >
                            {field.value
                              ? (suppliersDb.find((s) => s.id === field.value)?.name ?? "Lieferant auswählen...")
                              : "Lieferant auswählen..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                        <Command>
                          <CommandInput placeholder="Lieferant suchen..." />
                          <CommandList>
                            <CommandEmpty>Kein Lieferant gefunden</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none__"
                                onSelect={() => {
                                  field.onChange(null);
                                  setSupplierDbOpen(false);
                                }}
                              >
                                <X className="mr-2 h-4 w-4" />
                                Kein Lieferant
                              </CommandItem>
                              {suppliersDb.map((s) => (
                                <CommandItem
                                  key={s.id}
                                  value={s.name}
                                  onSelect={() => {
                                    field.onChange(s.id);
                                    setSupplierDbOpen(false);
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${field.value === s.id ? "opacity-100" : "opacity-0"}`} />
                                  <span>{s.name}</span>
                                  {s.contactPerson ? (
                                    <span className="ml-2 text-xs text-muted-foreground">({s.contactPerson})</span>
                                  ) : null}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <CommandGroup>
                              <CommandItem
                                value="__new_supplier__"
                                onSelect={() => {
                                  setSupplierDbOpen(false);
                                  setQuickAddSupplierOpen(true);
                                }}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" /> Neuen Lieferanten anlegen
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Technische Daten */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Technische Daten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="fuelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kraftstoffart</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Auswählen..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FUEL_TYPES.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>
                            {ft.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="transmission"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Getriebe</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Auswählen..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TRANSMISSIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Power PS with auto-calculation */}
              <FormField
                control={form.control}
                name="power"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leistung (PS)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(e) => handlePsChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Power kW with auto-calculation */}
              <FormField
                control={form.control}
                name="powerKw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leistung (kW)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(e) => handleKwChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displacement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hubraum (cm³)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="z.B. 1998"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="co2Emission"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CO₂-Ausstoß (g/km)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="z.B. 120"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Body type, doors, seats, drive type, emission class */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2 border-t">
              <FormField
                control={form.control}
                name="bodyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Karosserieform</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Auswählen..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BODY_TYPES.map((bt) => (
                          <SelectItem key={bt.value} value={bt.value}>
                            {bt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="driveType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Antrieb</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Auswählen..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DRIVE_TYPES.map((dt) => (
                          <SelectItem key={dt.value} value={dt.value}>
                            {dt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emissionClass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schadstoffklasse</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Auswählen..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EMISSION_CLASSES.map((ec) => (
                          <SelectItem key={ec.value} value={ec.value}>
                            {ec.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="doors"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Türen</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="z.B. 4"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sitzplätze</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="z.B. 5"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Damage section */}
            <div className="space-y-3 pt-2 border-t">
              <FormField
                control={form.control}
                name="hasDamage"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-medium">
                      Vorschäden vorhanden
                    </FormLabel>
                  </FormItem>
                )}
              />

              {watchedHasDamage ? (
                <div className="grid gap-4 sm:grid-cols-2 pl-1">
                  <FormField
                    control={form.control}
                    name="damageDescription"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Beschreibung der Vorschäden</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Beschreibung der Schäden..."
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="damageAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schadenshöhe (€)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Section 2b: Fahrzeughistorie & Wartung */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fahrzeughistorie & Wartung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="previousOwners"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anzahl Vorbesitzer</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="huDue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nächste HU fällig</FormLabel>
                    <FormControl>
                      <Input
                        type="month"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="serviceDueKm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service fällig bei km</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="z.B. 50000"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceDueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service fällig am (Datum)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Hybrid & Electric - only shown for Elektro or Hybrid */}
        {isElectricOrHybrid ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hybrid- & Elektrofahrzeuge</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="batteryCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batteriegröße (kWh)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="z.B. 75.0"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="electricRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Elektrische Reichweite WLTP (km)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="z.B. 500"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="batterySoh"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SOH – Zustand der Batterie (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="z.B. 95"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="batteryType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batterietyp</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. Lithium-Ionen" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chargingTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ladezeit 20–80 % (Minuten)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="z.B. 30"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Stecker-Typ dropdown */}
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="connectorType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stecker-Typ</FormLabel>
                      <Popover open={connectorOpen} onOpenChange={setConnectorOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={connectorOpen}
                              className="w-full justify-between font-normal"
                            >
                              {field.value ? field.value : "Stecker-Typ auswählen..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                          <Command>
                            <CommandInput placeholder="Suchen..." />
                            <CommandList>
                              <CommandEmpty>Keine Ergebnisse</CommandEmpty>
                              <CommandGroup>
                                {allConnectors.map((c) => (
                                  <CommandItem
                                    key={c}
                                    value={c}
                                    onSelect={(val) => {
                                      field.onChange(val);
                                      setConnectorOpen(false);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${field.value === c ? "opacity-100" : "opacity-0"}`} />
                                    {c}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandGroup>
                                <CommandItem
                                  value="__add_new__"
                                  onSelect={() => { setShowAddConnector(true); setConnectorOpen(false); }}
                                >
                                  <PlusCircle className="mr-2 h-4 w-4" /> Stecker-Typ hinzufügen
                                </CommandItem>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {showAddConnector ? (
                  <div className="flex gap-2 items-center rounded-lg border bg-muted/40 p-3">
                    <Input
                      placeholder="z.B. NACS"
                      value={newConnectorInput}
                      onChange={(e) => setNewConnectorInput(e.target.value)}
                      className="h-8 text-sm flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddConnector(); } }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      disabled={!newConnectorInput.trim() || addConnectorMutation.isPending}
                      onClick={handleAddConnector}
                    >
                      {addConnectorMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Hinzufügen"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => { setShowAddConnector(false); setNewConnectorInput(""); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Section 4: Ausstattung */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ausstattung</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="features"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ausstattungsmerkmale</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Kommagetrennt eingeben, z.B. Navi, Leder, Sitzheizung, Parkassistent"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section 5: Preise & Steuern */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preise & Steuern</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Margin tax toggle */}
            <FormField
              control={form.control}
              name="marginTaxed"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer">
                      Differenzbesteuerung (&sect;25a UStG)
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      {watchedMarginTaxed
                        ? "Der Verkaufspreis ist der Endpreis (Brutto = Netto)."
                        : "Regelbesteuerung: MwSt wird auf den Nettopreis aufgeschlagen."}
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Purchase price */}
              <FormField
                control={form.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchedMarginTaxed ? "Einkaufspreis" : "Einkaufspreis (Netto)"}
                      <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? ("" as unknown as number) : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tax rate - only shown for Regelbesteuerung */}
              {!watchedMarginTaxed ? (
                <FormField
                  control={form.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MwSt-Satz (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            {/* Selling price with netto/brutto toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Verkaufspreis
                  <RequiredMark />
                </Label>
                {!watchedMarginTaxed ? (
                  <Tabs
                    value={priceInputMode}
                    onValueChange={(v) => setPriceInputMode(v as "netto" | "brutto")}
                  >
                    <TabsList className="h-8">
                      <TabsTrigger value="netto" className="text-xs px-3 h-6">
                        Netto eingeben
                      </TabsTrigger>
                      <TabsTrigger value="brutto" className="text-xs px-3 h-6">
                        Brutto eingeben
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                ) : null}
              </div>

              {watchedMarginTaxed ? (
                <div>
                  <FormField
                    control={form.control}
                    name="sellingPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Verkaufspreis (Endpreis)
                          <RequiredMark />
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? ("" as unknown as number) : Number(e.target.value)
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Differenzbesteuert -- dies ist der Endpreis inkl. aller Abgaben.
                  </p>
                </div>
              ) : priceInputMode === "netto" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="sellingPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Netto
                          <RequiredMark />
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={field.value ?? ""}
                            onChange={(e) => handleNettoChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Brutto (berechnet)</Label>
                    <div className="flex h-10 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                      {formatPrice(grossPrice)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      Brutto
                      <RequiredMark />
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={grossDisplay}
                      onChange={(e) => handleGrossChange(e.target.value)}
                      className={sellingPriceHasError ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {sellingPriceHasError ? (
                      <p className="text-sm font-medium text-destructive">
                        {form.formState.errors.sellingPrice?.message as string}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Netto (berechnet)</Label>
                    <div className="flex h-10 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                      {formatPrice(watchedSellingPrice)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Transportkosten Inland - always visible */}
            <FormField
              control={form.control}
              name="transportCostDomestic"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Transportkosten Inland (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dealer price */}
            <FormField
              control={form.control}
              name="dealerPrice"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Händlerpreis (EUR)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Preis für Händler, die das Fahrzeug im Ist-Zustand ankaufen.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Margin summary */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="grid gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Einkauf</p>
                  <p className="font-semibold">{formatPrice(watchedPurchasePrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Verkauf (Brutto)</p>
                  <p className="font-semibold">{formatPrice(grossPrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Nebenkosten</p>
                  <p className="font-semibold text-orange-500">{formatPrice(totalAdditionalCosts)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Marge (Netto)</p>
                  <p className={`font-semibold ${margin >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {formatPrice(margin)}
                  </p>
                </div>
              </div>
              {totalAdditionalCosts > 0 ? (
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {domesticTransportCost > 0 ? <p>Transport Inland: {formatPrice(domesticTransportCost)}</p> : null}
                  {watchedExportEnabled && exportOnlyCosts > 0 ? <p>Exportkosten: {formatPrice(exportOnlyCosts)}</p> : null}
                  {existingAdditionalCosts > 0 ? <p>Bereits erfasste Zusatzkosten: {formatPrice(existingAdditionalCosts)}</p> : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Export / Portugal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-3">
              Export / Portugal
              <FormField
                control={form.control}
                name="exportEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 m-0 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal cursor-pointer">
                      Export aktivieren
                    </FormLabel>
                  </FormItem>
                )}
              />
            </CardTitle>
          </CardHeader>
          {watchedExportEnabled ? (
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="transportCostAbroad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transportkosten Ausland (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customsDuties"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zollgebühren (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="registrationFees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gebühren Zulassung (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="repairCostsAbroad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reparaturkosten Ausland (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Export total */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between text-sm">
                  <p className="text-muted-foreground font-medium">Gesamte Exportkosten</p>
                  <p className="font-bold text-base">{formatPrice(exportTotal)}</p>
                </div>
              </div>
            </CardContent>
          ) : null}
        </Card>

        {/* Section 7: Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status & Besondere Informationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Besondere Informationen (erscheint im Kaufvertrag)</FormLabel>
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Besondere Vereinbarungen, Zusatzinfos für den Kaufvertrag..."
                    rows={5}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interne Bemerkungen (erscheint nicht im Kaufvertrag)</FormLabel>
                  <Textarea
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Interne Hinweise, To-dos, Absprachen..."
                    rows={4}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {submitLabel}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/vehicles">Abbrechen</Link>
          </Button>
        </div>
      </form>

      <QuickAddSupplierDialog
        open={quickAddSupplierOpen}
        onOpenChange={setQuickAddSupplierOpen}
        onSupplierCreated={(supplier) => {
          form.setValue("supplierId", supplier.id);
        }}
      />
    </Form>
  );
}
