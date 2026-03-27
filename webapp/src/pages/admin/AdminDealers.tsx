import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import type { DealerSubscription as SharedDealerSubscription } from "../../../../backend/src/types";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
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

type Plan = {
  id: string;
  name: string;
  slug: string;
};

type DealerStatus = "active" | "suspended" | "inactive";
type DealerSetupStatus = "pending_setup" | "ready_for_dns" | "active" | "suspended";

type DealerMembership = {
  id: string;
  role: "dealer_owner" | "dealer_admin" | "staff";
  isActive: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    username?: string | null;
  };
};

type Dealer = {
  id: string;
  name: string;
  slug: string;
  status: DealerStatus;
  setupStatus: DealerSetupStatus;
  isDefault?: boolean;
  settings?: {
    displayName?: string | null;
  } | null;
  memberships: DealerMembership[];
  subscriptions: SharedDealerSubscription[];
  _count: {
    vehicles: number;
    customers: number;
    suppliers: number;
    memberships: number;
  };
};

type DealerEditForm = {
  name: string;
  slug: string;
  status: DealerStatus;
  setupStatus: DealerSetupStatus;
  ownerName: string;
  ownerEmail: string;
  ownerUsername: string;
  ownerPassword: string;
};

const PRIVATE_VEHICLES_FEATURE_KEY = "private_vehicles";

function getPrimaryOwner(dealer: Dealer) {
  return dealer.memberships.find((membership) => membership.role === "dealer_owner") ?? null;
}

function createEditForm(dealer: Dealer): DealerEditForm {
  const owner = getPrimaryOwner(dealer);

  return {
    name: dealer.name,
    slug: dealer.slug,
    status: dealer.status,
    setupStatus: dealer.setupStatus,
    ownerName: owner?.user.name ?? "",
    ownerEmail: owner?.user.email ?? "",
    ownerUsername: owner?.user.username ?? "",
    ownerPassword: "",
  };
}

function getCurrentSubscription(dealer: Dealer) {
  return dealer.subscriptions[0] ?? null;
}

function getFeatureEnabled(subscription: SharedDealerSubscription | null, key: string) {
  if (!subscription) {
    return false;
  }

  if (typeof subscription.featureOverrides?.[key] === "boolean") {
    return subscription.featureOverrides[key] === true;
  }

  return subscription.plan?.featureEntitlements?.[key] === true;
}

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
  const [editingDealer, setEditingDealer] = useState<Dealer | null>(null);
  const [editForm, setEditForm] = useState<DealerEditForm | null>(null);

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
      toast({ title: "Autohaus angelegt" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Autohaus konnte nicht angelegt werden.",
        variant: "destructive",
      });
    },
  });

  const updateDealerMutation = useMutation({
    mutationFn: ({ dealerId, data }: { dealerId: string; data: Record<string, unknown> }) =>
      api.put(`/api/admin/dealers/${dealerId}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dealers"] });
      toast({ title: "Autohaus aktualisiert" });
      setEditingDealer(null);
      setEditForm(null);
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Autohaus konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const deleteDealerMutation = useMutation({
    mutationFn: (dealerId: string) => api.delete(`/api/admin/dealers/${dealerId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dealers"] });
      toast({ title: "Autohaus gelöscht" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Autohaus konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    },
  });

  const subscriptionMutation = useMutation({
    mutationFn: ({
      dealerId,
      planId,
      complimentaryAccess,
      featureOverrides,
    }: {
      dealerId: string;
      planId: string;
      complimentaryAccess?: boolean;
      featureOverrides?: Record<string, boolean>;
    }) =>
      api.put(`/api/admin/subscriptions/${dealerId}`, {
        planId,
        status: "active",
        complimentaryAccess,
        featureOverrides,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dealers"] });
      toast({ title: "Tarif aktualisiert" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Tarif konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const complimentaryMutation = useMutation({
    mutationFn: ({ dealerId, complimentaryAccess }: { dealerId: string; complimentaryAccess: boolean }) =>
      api.put(`/api/admin/subscriptions/${dealerId}/complimentary`, { complimentaryAccess }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dealers"] });
      toast({
        title: variables.complimentaryAccess ? "Kostenlos freigeschaltet" : "Gratis-Freigabe entfernt",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Gratis-Freigabe konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (dealer: Dealer) => {
    setEditingDealer(dealer);
    setEditForm(createEditForm(dealer));
  };

  if (session?.user.platformRole !== "platform_super_admin") {
    return <div className="text-sm text-muted-foreground">Kein Zugriff auf diese Seite.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-6 text-slate-50">
        <div className="text-sm uppercase tracking-[0.2em] text-cyan-200/80">Plattform</div>
        <h1 className="mt-2 text-3xl font-semibold">CarOps Kunden verwalten</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Hier verwaltest du SaaS-Kunden, Owner-Zugangsdaten, Tarif, Gratis-Freigaben und den Autohaus-Status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Neues Autohaus</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[
            ["name", "Autohaus-Name"],
            ["slug", "Slug"],
            ["ownerName", "Owner-Name"],
            ["ownerEmail", "Owner-E-Mail"],
            ["ownerUsername", "Owner-Benutzername"],
            ["ownerPassword", "Start-Passwort"],
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
            {createDealerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Legt an...
              </>
            ) : (
              "Autohaus anlegen"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kundenübersicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(dealersQuery.data ?? []).map((dealer) => {
            const owner = getPrimaryOwner(dealer);
            const currentSubscription = getCurrentSubscription(dealer);
            const isDeleting = deleteDealerMutation.isPending && deleteDealerMutation.variables === dealer.id;
            const isUpdatingComplimentary =
              complimentaryMutation.isPending && complimentaryMutation.variables?.dealerId === dealer.id;

            return (
              <div key={dealer.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">{dealer.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {dealer.slug} • {dealer.status}
                      {dealer.isDefault ? " • Standard-Dealer" : ""}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Setup: {dealer.setupStatus}
                      {dealer.settings?.displayName ? ` • Anzeige: ${dealer.settings.displayName}` : ""}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {dealer._count.memberships} Nutzer • {dealer._count.vehicles} Fahrzeuge • {dealer._count.customers} Kunden
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Owner: {owner?.user.name ?? "Kein Owner"} {owner?.user.email ? `• ${owner.user.email}` : ""}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant={currentSubscription?.complimentaryAccess ? "default" : "outline"}>
                        {currentSubscription?.complimentaryAccess ? "Kostenlos aktiv" : "Kostenpflichtig"}
                      </Badge>
                      <span className="text-muted-foreground">
                        {currentSubscription?.plan?.name ?? "Kein Tarif"}
                        {currentSubscription?.status ? ` • ${currentSubscription.status}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="grid w-full gap-3 xl:w-[320px]">
                    <Select
                      value={currentSubscription?.planId ?? ""}
                      onValueChange={(value) =>
                        subscriptionMutation.mutate({
                          dealerId: dealer.id,
                          planId: value,
                          complimentaryAccess: currentSubscription?.complimentaryAccess ?? false,
                          featureOverrides: currentSubscription?.featureOverrides ?? {},
                        })
                      }
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

                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">Kostenloser Zugang</div>
                        <div className="text-xs text-muted-foreground">
                          Hebt die Paywall für dieses Autohaus direkt auf.
                        </div>
                      </div>
                      <Switch
                        checked={currentSubscription?.complimentaryAccess ?? false}
                        disabled={!currentSubscription || isUpdatingComplimentary}
                        onCheckedChange={(checked) =>
                          complimentaryMutation.mutate({
                            dealerId: dealer.id,
                            complimentaryAccess: checked,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-3">
                      <div className="space-y-1 pr-4">
                        <div className="text-sm font-medium text-foreground">Private Fahrzeuge</div>
                        <div className="text-xs text-muted-foreground">
                          Zeigt den Privat-Switch und die Privat-Filter nur für dieses Autohaus an.
                        </div>
                      </div>
                      <Switch
                        checked={getFeatureEnabled(currentSubscription, PRIVATE_VEHICLES_FEATURE_KEY)}
                        disabled={!currentSubscription || subscriptionMutation.isPending}
                        onCheckedChange={(checked) =>
                          currentSubscription
                            ? subscriptionMutation.mutate({
                                dealerId: dealer.id,
                                planId: currentSubscription.planId,
                                complimentaryAccess: currentSubscription.complimentaryAccess ?? false,
                                featureOverrides: {
                                  ...(currentSubscription.featureOverrides ?? {}),
                                  [PRIVATE_VEHICLES_FEATURE_KEY]: checked,
                                },
                              })
                            : undefined
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="outline" onClick={() => openEditDialog(dealer)} className="flex-1">
                        <Pencil className="mr-2 h-4 w-4" />
                        Bearbeiten
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={dealer.isDefault || isDeleting}
                            className="flex-1"
                          >
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
                            <AlertDialogTitle>Autohaus löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {dealer.name} wird komplett entfernt. Zugehörige Daten dieses Dealers werden gelöscht. Benutzer ohne weitere Autohaus-Zuordnung werden ebenfalls entfernt.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteDealerMutation.mutate(dealer.id)}>
                              Löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Login-Link für Kunden: <span className="font-mono">/login</span>
                      <br />
                      Admin-Link für dich: <span className="font-mono">/admin/login</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editingDealer && editForm)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingDealer(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Autohaus bearbeiten</DialogTitle>
            <DialogDescription>
              Dealer-Daten, Owner-Zugang und Status zentral im Superadmin-Bereich pflegen.
            </DialogDescription>
          </DialogHeader>

          {editingDealer && editForm ? (
            <div className="grid gap-4 py-2 md:grid-cols-2">
              {[
                ["name", "Dealer-Name"],
                ["slug", "Slug"],
                ["ownerName", "Owner-Name"],
                ["ownerEmail", "Owner-E-Mail"],
                ["ownerUsername", "Owner-Benutzername"],
                ["ownerPassword", "Neues Owner-Passwort"],
              ].map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`edit-${key}`}>{label}</Label>
                  <Input
                    id={`edit-${key}`}
                    type={key === "ownerPassword" ? "password" : "text"}
                    value={editForm[key as keyof DealerEditForm] as string}
                    placeholder={key === "ownerPassword" ? "Leer lassen, um es nicht zu ändern" : undefined}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current ? { ...current, [key]: event.target.value } : current
                      )
                    }
                  />
                </div>
              ))}

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value: DealerStatus) =>
                    setEditForm((current) => (current ? { ...current, status: value } : current))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="suspended">Gesperrt</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Setup-Status</Label>
                <Select
                  value={editForm.setupStatus}
                  onValueChange={(value: DealerSetupStatus) =>
                    setEditForm((current) => (current ? { ...current, setupStatus: value } : current))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending_setup">Pending Setup</SelectItem>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="suspended">Gesperrt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingDealer(null);
                setEditForm(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={updateDealerMutation.isPending}
              onClick={() => {
                if (!editingDealer || !editForm) return;

                const payload: Record<string, unknown> = {
                  name: editForm.name,
                  slug: editForm.slug,
                  status: editForm.status,
                  setupStatus: editForm.setupStatus,
                  owner: {
                    name: editForm.ownerName,
                    email: editForm.ownerEmail,
                    username: editForm.ownerUsername || null,
                  },
                };

                if (editForm.ownerPassword.trim()) {
                  (payload.owner as Record<string, unknown>).password = editForm.ownerPassword;
                }

                updateDealerMutation.mutate({
                  dealerId: editingDealer.id,
                  data: payload,
                });
              }}
            >
              {updateDealerMutation.isPending ? (
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
