import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type TeamMember = {
  id: string;
  role: "dealer_owner" | "dealer_admin" | "staff";
  isDefault: boolean;
  isActive: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    username?: string | null;
  };
};

const ROLE_LABELS: Record<TeamMember["role"], string> = {
  dealer_owner: "Owner",
  dealer_admin: "Admin",
  staff: "Mitarbeiter",
};

export default function SettingsTeam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuth();
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "staff" as TeamMember["role"],
  });

  const teamQuery = useQuery({
    queryKey: ["dealer-team"],
    queryFn: () => api.get<TeamMember[]>("/api/settings/team"),
    enabled: session?.dealerRole === "dealer_owner" || session?.dealerRole === "dealer_admin",
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
    mutationFn: ({ membershipId, data }: { membershipId: string; data: Partial<TeamMember> }) =>
      api.put(`/api/settings/team/${membershipId}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dealer-team"] });
    },
  });

  if (!(session?.dealerRole === "dealer_owner" || session?.dealerRole === "dealer_admin")) {
    return <div className="text-sm text-muted-foreground">Kein Zugriff auf diese Seite.</div>;
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
                value={newMember[key as keyof typeof newMember]}
                onChange={(event) => setNewMember((current) => ({ ...current, [key]: event.target.value }))}
              />
            </div>
          ))}
          <div className="space-y-2">
            <Label>Rolle</Label>
            <Select
              value={newMember.role}
              onValueChange={(value: TeamMember["role"]) => setNewMember((current) => ({ ...current, role: value }))}
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
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full md:w-fit">
            Teammitglied anlegen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bestehendes Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(teamQuery.data ?? []).map((member) => (
            <div key={member.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">{member.user.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {member.user.email} {member.user.username ? `• ${member.user.username}` : ""}
                  </div>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <Select
                    value={member.role}
                    onValueChange={(value: TeamMember["role"]) =>
                      updateMutation.mutate({ membershipId: member.id, data: { role: value } })
                    }
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
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({ membershipId: member.id, data: { isActive: checked } })
                      }
                    />
                    <span className="text-sm">Aktiv</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={member.isDefault}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({ membershipId: member.id, data: { isDefault: checked } })
                      }
                    />
                    <span className="text-sm">Standard</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
