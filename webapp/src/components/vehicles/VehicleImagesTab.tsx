import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, X, ImageIcon, Loader2, Star } from "lucide-react";
import { type VehicleImage, getFileUrl } from "@/lib/vehicles";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface VehicleImagesTabProps {
  vehicleId: string;
  images?: VehicleImage[];
}

export function VehicleImagesTab({ vehicleId, images }: VehicleImagesTabProps) {
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);

  const { data: vehicleData } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => api.get<{ images: VehicleImage[] }>(`/api/vehicles/${vehicleId}`),
    enabled: !!vehicleId,
  });
  const displayImages = vehicleData?.images ?? images ?? [];

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${baseUrl}/api/vehicles/${vehicleId}/images`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload fehlgeschlagen");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Bild hochgeladen");
    },
    onError: () => {
      toast.error("Fehler beim Hochladen");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
      const res = await fetch(
        `${baseUrl}/api/vehicles/${vehicleId}/images/${imageId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error("Löschen fehlgeschlagen");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Bild gelöscht");
    },
    onError: () => {
      toast.error("Fehler beim Löschen");
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const response = await api.raw(`/api/vehicles/${vehicleId}/images/${imageId}/primary`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Hauptfoto konnte nicht gesetzt werden");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Hauptfoto aktualisiert");
    },
    onError: () => {
      toast.error("Fehler beim Setzen des Hauptfotos");
    },
  });

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => {
        if (file.type.startsWith("image/")) {
          uploadMutation.mutate(file);
        }
      });
    },
    [uploadMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
          isDragging
            ? "border-amber-500 bg-amber-500/5"
            : "border-muted-foreground/20 hover:border-muted-foreground/40"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.multiple = true;
          input.onchange = () => handleFiles(input.files);
          input.click();
        }}
      >
        {uploadMutation.isPending ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Bilder hierher ziehen oder klicken zum Hochladen
            </p>
          </>
        )}
      </div>

      {/* Image grid */}
      {displayImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <ImageIcon className="mb-2 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Noch keine Bilder vorhanden
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {displayImages.map((image) => (
            <div
              key={image.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted"
            >
              <img
                src={getFileUrl(image.url)}
                alt="Fahrzeugbild"
                className="h-full w-full object-contain p-2 transition-transform group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/30" />
              <div className="absolute left-2 top-2">
                {image.isPrimary ? (
                  <Badge className="bg-amber-500 text-black hover:bg-amber-500">Hauptfoto</Badge>
                ) : null}
              </div>
              {!image.isPrimary ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2 left-2 opacity-0 transition-opacity group-hover:opacity-100"
                  disabled={setPrimaryMutation.isPending}
                  onClick={() => setPrimaryMutation.mutate(image.id)}
                >
                  <Star className="mr-2 h-4 w-4" />
                  Als Hauptfoto
                </Button>
              ) : null}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                    disabled={deleteMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bild löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dieses Bild wird unwiderruflich gelöscht.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate(image.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
