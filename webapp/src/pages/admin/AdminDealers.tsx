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

type Plan = {
  id: string;
  name: string;
  slug: string;
};

type Dealer = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "inactive";
  subscriptions: Array<{ planId: string; plan?: { name: string } }>;
  _count: {
    vehicles: number;
    customers: number;
    suppliers: number;
    memberships: number;
  };
};

export default function AdminDealers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuth();
  const [newDealer, setNewDealer] = useState({
    name: "",
    slug: "",
    ownerName: "",
    ownerEmail: "",
    ownerUsername: "",
    ownerPassword: "",
  });

  const dealersQuery = useQuery({
    queryKey: ["admin-dealers"],
    queryFn: () => api.get<Dealer[]>("/api/admin/dealers"),
    enabled: session?.user.platformRole === "platform_super_admin",
  });

  const plansQuery = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => api.get<Plan[]>("/api/admin/plans"),
    enabled: session?.user.platformRole === "platform_super_admin",
  });

  const createDealerMutation = useMutation({
    mutationFn: () =>
      api.post("/api/admin/dealers", {
        name: newDealer.name,
        slug: newDealer.slug || undefined,
        owner: {
          name: newDealer.ownerName,
          email: newDealer.ownerEmail,
          username: newDealer.ownerUsername,
          password: newDealer.ownerPassword,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dealers"] });
      setNewDealer({
        name: "",
        slug: "",
        ownerName: "",
        ownerEmail: "",
        ownerUsername: "",
        ownerPassword: "",
      });
      toast({ title: "Dealer angelegt" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Dealer konnte nicht angelegt werden.",
        variant: "destructive",
      });
    },
  });

  const subscriptionMutation = useMutation({
    mutationFn: ({ dealerId, planId }: { dealerId: string; planId: string }) =>
      api.put(`/api/admin/subscriptions/${dealerId}`, { planId, status: "active" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dealers"] });
      toast({ title: "Tarif aktualisiert" });
    },
  });

  if (session?.user.platformRole !== "platform_super_admin") {
    return <div className="text-sm text-muted-foreground">Kein Zugriff auf diese Seite.</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Neues Autohaus</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[
            ["name", "Dealer-Name"],
            ["slug", "Slug"],
            ["ownerName", "Owner-Name"],
            ["ownerEmail", "Owner-E-Mail"],
            ["ownerUsername", "Owner-Benutzername"],
            ["ownerPassword", "Owner-Passwort"],
          ].map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type={key === "ownerPassword" ? "password" : "text"}
                value={newDealer[key as keyof typeof newDealer]}
                onChange={(event) => setNewDealer((current) => ({ ...current, [key]: event.target.value }))}
              />
            </div>
          ))}
          <Button onClick={() => createDealerMutation.mutate()} disabled={createDealerMutation.isPending} className="w-full md:w-fit">
            Dealer anlegen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dealer-Übersicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(dealersQuery.data ?? []).map((dealer) => (
            <div key={dealer.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">{dealer.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {dealer.slug} • {dealer.status}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {dealer._count.memberships} Nutzer • {dealer._count.vehicles} Fahrzeuge • {dealer._count.customers} Kunden
                  </div>
                </div>
                <div className="w-full md:w-[220px]">
                  <Select
                    value={dealer.subscriptions[0]?.planId ?? ""}
                    onValueChange={(value) => subscriptionMutation.mutate({ dealerId: dealer.id, planId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tarif wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {(plansQuery.data ?? []).map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
