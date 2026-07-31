import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

type TeamRole = "dealer_owner" | "dealer_admin" | "staff";

type TeamMember = {
  id: string;
  role: TeamRole;
  isDefault: boolean;
  isActive: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    username?: string | null;
  };
};

type TeamMemberEditForm = {
  name: string;
  email: string;
  username: string;
  password: string;
  role: TeamRole;
  isActive: boolean;
};

const ROLE_LABELS: Record<TeamRole, string> = {
  dealer_owner: "Owner",
  dealer_admin: "Admin",
  staff: "Mitarbeiter",
};

function createEditForm(member: TeamMember): TeamMemberEditForm {
  return {
    name: member.user.name,
    email: member.user.email,
    username: member.user.username ?? "",
    password: "",
    role: member.role,
    isActive: member.isActive,
  };
}

export default function SettingsTeam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuth();
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "staff" as TeamRole,
  });
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState<TeamMemberEditForm | null>(null);

  const teamQuery = useQuery({
    queryKey: ["dealer-team"],
    queryFn: () => api.get<TeamMember[]>("/api/settings/team"),
    enabled:
      (session?.dealerRole === "dealer_owner" || session?.dealerRole === "dealer_admin") &&
      session?.entitlements?.team_management === true,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/api/settings/team", newMember),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dealer-team"] });
      setNewMember({ name: "", email: "", username: "", password: "", role: "staff" });
      toast({ title: "Teammitglied angelegt" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Teammitglied konnte nicht angelegt werden.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ membershipId, data }: { membershipId: string; data: Record<string, unknown> }) =>
      api.put(`/api/settings/team/${membershipId}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dealer-team"] });
      toast({ title: "Teammitglied aktualisiert" });
      setEditingMember(null);
      setEditForm(null);
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Teammitglied konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (membershipId: string) => api.delete(`/api/settings/team/${membershipId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dealer-team"] });
      toast({ title: "Teammitglied entfernt" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Teammitglied konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (member: TeamMember) => {
    setEditingMember(member);
    setEditForm(createEditForm(member));
  };

  const quickUpdate = (membershipId: string, data: Record<string, unknown>) => {
    updateMutation.mutate({ membershipId, data });
  };

  if (!(session?.dealerRole === "dealer_owner" || session?.dealerRole === "dealer_admin")) {
    return <div className="text-sm text-muted-foreground">Kein Zugriff auf diese Seite.</div>;
  }

  if (session?.entitlements?.team_management !== true) {
    return <div className="text-sm text-muted-foreground">Teamverwaltung ist in deinem Tarif nicht enthalten.</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Neues Teammitglied</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[
            ["name", "Name"],
            ["email", "E-Mail"],
            ["username", "Benutzername"],
            ["password", "Passwort"],
          ].map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type={key === "password" ? "password" : "text"}
                minLength={key === "password" ? 12 : undefined}
                autoComplete={key === "password" ? "new-password" : undefined}
                value={newMember[key as keyof typeof newMember]}
                onChange={(event) => setNewMember((current) => ({ ...current, [key]: event.target.value }))}
              />
            </div>
          ))}
          <div className="space-y-2">
            <Label>Rolle</Label>
            <Select
              value={newMember.role}
              onValueChange={(value: TeamRole) => setNewMember((current) => ({ ...current, role: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Mitarbeiter</SelectItem>
                <SelectItem value="dealer_admin">Admin</SelectItem>
                <SelectItem value="dealer_owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              createMutation.isPending ||
              !newMember.name.trim() ||
              !newMember.email.trim() ||
              !newMember.username.trim() ||
              newMember.password.length < 12
            }
            className="w-full md:w-fit"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Legt an...
              </>
            ) : (
              "Teammitglied anlegen"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bestehendes Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(teamQuery.data ?? []).map((member) => {
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === member.id;
            return (
              <div key={member.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-medium">{member.user.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {member.user.email} {member.user.username ? `• ${member.user.username}` : ""}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Rolle: {ROLE_LABELS[member.role]} • {member.isActive ? "Aktiv" : "Inaktiv"}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <Select
                      value={member.role}
                      onValueChange={(value: TeamRole) => quickUpdate(member.id, { role: value })}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue>{ROLE_LABELS[member.role]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Mitarbeiter</SelectItem>
                        <SelectItem value="dealer_admin">Admin</SelectItem>
                        <SelectItem value="dealer_owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={member.isActive}
                        onCheckedChange={(checked) => quickUpdate(member.id, { isActive: checked })}
                      />
                      <span className="text-sm">Aktiv</span>
                    </div>

                    <Button type="button" variant="outline" onClick={() => openEditDialog(member)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Bearbeiten
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" disabled={isDeleting}>
                          {isDeleting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Löscht...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Löschen
                            </>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Teammitglied löschen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {member.user.name} wird aus diesem Autohaus entfernt. Wenn der Benutzer zu keinem weiteren
                            Autohaus gehört, wird der Account komplett gelöscht.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(member.id)}>
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editingMember && editForm)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMember(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Teammitglied bearbeiten</DialogTitle>
            <DialogDescription>
              {editingMember?.user.id === session?.user.id
                ? "Eigene Stammdaten sowie Rolle und Status dieser Mitgliedschaft anpassen."
                : "Rolle und Status dieser Mitgliedschaft anpassen. Globale Zugangsdaten kann nur die betreffende Person selbst ändern."}
            </DialogDescription>
          </DialogHeader>

          {editingMember && editForm ? (
            <div className="grid gap-4 py-2 md:grid-cols-2">
              {editingMember.user.id === session?.user.id ? [
                ["name", "Name"],
                ["email", "E-Mail"],
                ["username", "Benutzername"],
                ["password", "Neues Passwort"],
              ].map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`edit-${key}`}>{label}</Label>
                  <Input
                    id={`edit-${key}`}
                    type={key === "password" ? "password" : "text"}
                    minLength={key === "password" ? 12 : undefined}
                    autoComplete={key === "password" ? "new-password" : undefined}
                    value={editForm[key as keyof TeamMemberEditForm] as string}
                    placeholder={key === "password" ? "Leer lassen, um es nicht zu ändern" : undefined}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current ? { ...current, [key]: event.target.value } : current
                      )
                    }
                  />
                </div>
              )) : null}

              <div className="space-y-2">
                <Label>Rolle</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(value: TeamRole) =>
                    setEditForm((current) => (current ? { ...current, role: value } : current))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Mitarbeiter</SelectItem>
                    <SelectItem value="dealer_admin">Admin</SelectItem>
                    <SelectItem value="dealer_owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Aktiv</div>
                  <div className="text-xs text-muted-foreground">Darf sich anmelden und arbeiten</div>
                </div>
                <Switch
                  checked={editForm.isActive}
                  onCheckedChange={(checked) =>
                    setEditForm((current) => (current ? { ...current, isActive: checked } : current))
                  }
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingMember(null);
                setEditForm(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!editingMember || !editForm) return;

                const payload: Record<string, unknown> = {
                  role: editForm.role,
                  isActive: editForm.isActive,
                };

                if (editingMember.user.id === session?.user.id) {
                  payload.name = editForm.name;
                  payload.email = editForm.email;
                  payload.username = editForm.username || null;
                  if (editForm.password.length > 0) {
                    payload.password = editForm.password;
                  }
                }

                updateMutation.mutate({
                  membershipId: editingMember.id,
                  data: payload,
                });
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Speichert...
                </>
              ) : (
                "Änderungen speichern"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
