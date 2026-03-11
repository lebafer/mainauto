import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, X, Loader2, Download } from "lucide-react";
import { type VehicleDocument, getFileUrl } from "@/lib/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

interface VehicleDocumentsTabProps {
  vehicleId: string;
  documents: VehicleDocument[];
}

export function VehicleDocumentsTab({
  vehicleId,
  documents,
}: VehicleDocumentsTabProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      name,
    }: {
      file: File;
      name: string;
    }) => {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      const res = await fetch(
        `${baseUrl}/api/vehicles/${vehicleId}/documents`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );
      if (!res.ok) throw new Error("Upload fehlgeschlagen");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      toast.success("Dokument hochgeladen");
      setDialogOpen(false);
      setDocName("");
      setDocFile(null);
    },
    onError: () => {
      toast.error("Fehler beim Hochladen");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || "";
      const res = await fetch(
        `${baseUrl}/api/vehicles/${vehicleId}/documents/${docId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error("Löschen fehlgeschlagen");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      toast.success("Dokument gelöscht");
    },
    onError: () => {
      toast.error("Fehler beim Löschen");
    },
  });

  function handleUpload() {
    if (!docFile || !docName.trim()) return;
    uploadMutation.mutate({ file: docFile, name: docName.trim() });
  }

  async function handleDownload(doc: VehicleDocument) {
    try {
      const response = await fetch(getFileUrl(doc.url), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Download fehlgeschlagen");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const extension = doc.url.split(".").pop()?.split("?")[0];
      const filename = extension && !doc.name.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
        ? `${doc.name}.${extension}`
        : doc.name;

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Fehler beim Download");
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Dokument hochladen
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokument hochladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dokumentname</Label>
              <Input
                placeholder="z.B. TÜV-Bericht, Kaufvertrag..."
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Datei</Label>
              <Input
                type="file"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              onClick={handleUpload}
              disabled={!docFile || !docName.trim() || uploadMutation.isPending}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {uploadMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Hochladen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FileText className="mb-2 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Noch keine Dokumente vorhanden
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString("de-DE")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a href={getFileUrl(doc.url)} target="_blank" rel="noopener noreferrer">
                    Öffnen
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{doc.name}" wird unwiderruflich gelöscht.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(doc.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
