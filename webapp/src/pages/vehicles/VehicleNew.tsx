import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { type Vehicle } from "@/lib/vehicles";
import { type VehicleBriefDocumentType } from "../../../../backend/src/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VehicleForm, type VehicleFormSubmitValues } from "@/components/vehicles/VehicleForm";
import { VehicleImagesTab } from "@/components/vehicles/VehicleImagesTab";
import { VehicleDocumentsTab } from "@/components/vehicles/VehicleDocumentsTab";

export default function VehicleNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createdVehicle, setCreatedVehicle] = useState<Vehicle | null>(null);
  const [pendingBriefFiles, setPendingBriefFiles] = useState<File[]>([]);
  const [pendingBriefDocumentType, setPendingBriefDocumentType] = useState<VehicleBriefDocumentType>("unknown");

  function getBriefDocumentLabel(documentType: VehicleBriefDocumentType): string {
    switch (documentType) {
      case "teil1":
        return "Fahrzeugschein";
      case "teil2":
        return "Fahrzeugbrief";
      default:
        return "Fahrzeugpapiere";
    }
  }

  async function uploadBriefDocuments(
    vehicleId: string,
    files: File[],
    documentType: VehicleBriefDocumentType
  ): Promise<number> {
    let uploaded = 0;
    const label = getBriefDocumentLabel(documentType);

    for (const [index, file] of files.entries()) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", files.length === 1 ? label : `${label} ${index + 1}`);

      const response = await api.raw(`/api/vehicles/${vehicleId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || "Fahrzeugpapiere konnten nicht gespeichert werden");
      }

      uploaded += 1;
    }

    return uploaded;
  }

  const createMutation = useMutation({
    mutationFn: (values: VehicleFormSubmitValues) =>
      api.post<Vehicle>("/api/vehicles", values),
    onSuccess: async (data) => {
      if (pendingBriefFiles.length > 0) {
        try {
          const uploaded = await uploadBriefDocuments(data.id, pendingBriefFiles, pendingBriefDocumentType);
          if (uploaded > 0) {
            toast.success(`${getBriefDocumentLabel(pendingBriefDocumentType)} gespeichert (${uploaded})`);
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Fahrzeugpapiere konnten nicht gespeichert werden");
        }
      }

      setPendingBriefFiles([]);
      setPendingBriefDocumentType("unknown");
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle", data.id] });
      setCreatedVehicle(data);
      toast.success("Fahrzeug angelegt!");
    },
    onError: (error: unknown) => {
      console.error("Vehicle creation error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Fehler beim Anlegen des Fahrzeugs. Bitte alle Pflichtfelder prüfen."
      );
    },
  });

  // ── Step 2: Upload images & documents ──────────────────────
  if (createdVehicle) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Success header */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fahrzeug angelegt!</h1>
            <p className="text-muted-foreground text-sm">
              <span className="font-mono">{createdVehicle.vehicleNumber}</span>
              {" · "}{createdVehicle.brand} {createdVehicle.model} {createdVehicle.firstRegistration ? `(${new Date(createdVehicle.firstRegistration).getFullYear()})` : createdVehicle.year ? `(${createdVehicle.year})` : ""}
            </p>
          </div>
        </div>

        {/* Image upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bilder hochladen</CardTitle>
          </CardHeader>
          <CardContent>
            <VehicleImagesTab vehicleId={createdVehicle.id} images={[]} />
          </CardContent>
        </Card>

        {/* Document upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dokumente hochladen</CardTitle>
          </CardHeader>
          <CardContent>
            <VehicleDocumentsTab vehicleId={createdVehicle.id} documents={[]} />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate(`/vehicles/${createdVehicle.id}`)}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Zum Fahrzeug
          </Button>
          <Button
            variant="outline"
            onClick={() => setCreatedVehicle(null)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Weiteres Fahrzeug anlegen
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 1: Vehicle form ────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/vehicles">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Neues Fahrzeug</h1>
          <p className="text-muted-foreground">
            Neues Fahrzeug zum Bestand hinzufügen
          </p>
        </div>
      </div>

      <VehicleForm
        onSubmit={(values) => createMutation.mutate(values)}
        isSubmitting={createMutation.isPending}
        submitLabel="Fahrzeug anlegen"
        onExtractedBriefFiles={(files, documentType) => {
          setPendingBriefFiles(files);
          setPendingBriefDocumentType(documentType);
        }}
      />
    </div>
  );
}
