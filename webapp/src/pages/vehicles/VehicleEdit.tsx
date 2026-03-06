import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { type Vehicle } from "@/lib/vehicles";
import { Button } from "@/components/ui/button";
import {
  VehicleForm,
  type VehicleFormSubmitValues,
} from "@/components/vehicles/VehicleForm";

export default function VehicleEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => api.get<Vehicle>(`/api/vehicles/${id}`),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (values: VehicleFormSubmitValues) =>
      api.put<Vehicle>(`/api/vehicles/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
      toast.success("Fahrzeug erfolgreich aktualisiert");
      navigate(`/vehicles/${id}`);
    },
    onError: (error: unknown) => {
      console.error("Vehicle update error:", error);
      toast.error("Fehler beim Aktualisieren des Fahrzeugs. Bitte alle Pflichtfelder prüfen.");
    },
  });

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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/vehicles/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {vehicle.brand} {vehicle.model} bearbeiten
          </h1>
          <p className="text-muted-foreground">
            Fahrzeugdaten aktualisieren
          </p>
        </div>
      </div>

      <VehicleForm
        vehicle={vehicle}
        onSubmit={(values) => updateMutation.mutate(values)}
        isSubmitting={updateMutation.isPending}
        submitLabel="Änderungen speichern"
      />
    </div>
  );
}
