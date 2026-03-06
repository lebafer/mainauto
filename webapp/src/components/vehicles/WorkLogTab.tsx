import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  CalendarDays,
  User,
  ChevronDown,
  ClipboardList,
} from "lucide-react";
import { api } from "@/lib/api";
import { type WorkLogItem } from "@/lib/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface WorkLogTabProps {
  vehicleId: string;
  workLog: WorkLogItem[];
}

type WorkLogStatus = "open" | "in_progress" | "done";

const STATUS_CONFIG: Record<WorkLogStatus, { label: string; className: string }> = {
  open: {
    label: "Offen",
    className: "bg-slate-500/15 text-slate-500 border-slate-500/20",
  },
  in_progress: {
    label: "In Arbeit",
    className: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  },
  done: {
    label: "Erledigt",
    className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  },
};

interface NewItemFormData {
  description: string;
  status: WorkLogStatus;
  assignee: string;
  dueDate: string;
}

const defaultFormData: NewItemFormData = {
  description: "",
  status: "open",
  assignee: "",
  dueDate: "",
};

export function WorkLogTab({ vehicleId, workLog }: WorkLogTabProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<NewItemFormData>(defaultFormData);

  const createMutation = useMutation({
    mutationFn: (data: NewItemFormData) =>
      api.post<WorkLogItem>(`/api/vehicles/${vehicleId}/worklog`, {
        description: data.description,
        status: data.status,
        assignee: data.assignee || undefined,
        dueDate: data.dueDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      toast.success("Eintrag hinzugefügt");
      setDialogOpen(false);
      setFormData(defaultFormData);
    },
    onError: () => {
      toast.error("Fehler beim Hinzufügen");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Partial<WorkLogItem> }) =>
      api.put<WorkLogItem>(`/api/vehicles/${vehicleId}/worklog/${itemId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      toast.success("Status aktualisiert");
    },
    onError: () => {
      toast.error("Fehler beim Aktualisieren");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.delete(`/api/vehicles/${vehicleId}/worklog/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      toast.success("Eintrag gelöscht");
    },
    onError: () => {
      toast.error("Fehler beim Löschen");
    },
  });

  function handleStatusChange(itemId: string, status: WorkLogStatus) {
    updateMutation.mutate({ itemId, data: { status } });
  }

  function handleCreate() {
    if (!formData.description.trim()) return;
    createMutation.mutate(formData);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {workLog.length === 0
              ? "Keine Einträge vorhanden"
              : `${workLog.length} ${workLog.length === 1 ? "Eintrag" : "Einträge"}`}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Arbeit hinzufügen
        </Button>
      </div>

      {/* Empty state */}
      {workLog.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <ClipboardList className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Noch keine Arbeiten erfasst</p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-3"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ersten Eintrag hinzufügen
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {workLog.map((item) => {
            const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.open;
            return (
              <Card key={item.id}>
                <CardContent className="flex items-start justify-between py-3 px-4 gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-medium leading-snug">{item.description}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.assignee ? (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.assignee}
                        </span>
                      ) : null}
                      {item.dueDate ? (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(item.dueDate).toLocaleDateString("de-DE")}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground/60">
                        {new Date(item.createdAt).toLocaleDateString("de-DE")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Status dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80",
                            statusCfg.className
                          )}
                          disabled={updateMutation.isPending}
                        >
                          {statusCfg.label}
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(Object.entries(STATUS_CONFIG) as [WorkLogStatus, typeof STATUS_CONFIG[WorkLogStatus]][]).map(
                          ([key, cfg]) => (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => handleStatusChange(item.id, key)}
                              className={item.status === key ? "font-medium" : ""}
                            >
                              <Badge
                                variant="outline"
                                className={cn("mr-2 text-xs", cfg.className)}
                              >
                                {cfg.label}
                              </Badge>
                            </DropdownMenuItem>
                          )
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Delete button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Dieser Eintrag wird unwiderruflich gelöscht.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add item dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arbeit hinzufügen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wl-description">Beschreibung *</Label>
              <Textarea
                id="wl-description"
                placeholder="Was muss gemacht werden?"
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wl-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, status: v as WorkLogStatus }))
                }
              >
                <SelectTrigger id="wl-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Offen</SelectItem>
                  <SelectItem value="in_progress">In Arbeit</SelectItem>
                  <SelectItem value="done">Erledigt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wl-assignee">Verantwortlicher</Label>
                <Input
                  id="wl-assignee"
                  placeholder="Name (optional)"
                  value={formData.assignee}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, assignee: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-dueDate">Fälligkeitsdatum</Label>
                <Input
                  id="wl-dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={!formData.description.trim() || createMutation.isPending}
              onClick={handleCreate}
            >
              <Plus className="mr-2 h-4 w-4" />
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
