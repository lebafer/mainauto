import { useRef, useState } from "react";
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
type DealerDomainStatus = "pending_dns" | "active" | "failed" | "disabled";

type DealerDomain = {
  id: string;
  dealerId: string;
  host: string;
  status: DealerDomainStatus;
  isPrimary: boolean;
  verificationToken?: string | null;
  verifiedAt?: string | null;
};

type Inquiry = {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
};

function generateUsernameFromInquiry(inquiry: Inquiry): string {
  const fromEmail = inquiry.email.split("@")[0]?.trim().toLowerCase();
  if (fromEmail && /^[a-z0-9._-]+$/i.test(fromEmail)) {
    return fromEmail.replace(/[^a-z0-9._-]/gi, "").slice(0, 24);
  }

  return inquiry.contactName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24);
}

function generateTemporaryPassword(): string {
  return `Start-${Math.random().toString(36).slice(2, 10)}!`;
}

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
  domains: DealerDomain[];
  memberships: DealerMembership[];
  subscriptions: Array<{ planId: string; plan?: { name: string } }>;
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

export default function AdminDealers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuth();
  const createDealerCardRef = useRef<HTMLDivElement | null>(null);
  const [newDomainByDealer, setNewDomainByDealer] = useState<Record<string, string>>({});
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
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

  const inquiriesQuery = useQuery({
    queryKey: ["admin-inquiries"],
    queryFn: () => api.get<Inquiry[]>("/api/admin/inquiries"),
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
      if (selectedInquiryId) {
        await api.patch(`/api/admin/inquiries/${selectedInquiryId}`, { status: "converted" });
        await queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] });
      }
      setNewDealer({
        name: "",
        slug: "",
        ownerName: "",
        ownerEmail: "",
        ownerUsername: "",
        ownerPassword: "",
      });
      setSelectedInquiryId(null);
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
    mutationFn: ({ dealerId, planId }: { dealerId: string; planId: string }) =>
      api.put(`/api/admin/subscriptions/${dealerId}`, { planId, status: "active" }),
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

  const createDomainMutation = useMutation({
    mutationFn: ({ dealerId, host }: { dealerId: string; host: string }) =>
      api.post(`/api/admin/dealers/${dealerId}/domains`, { host }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dealers"] });
      setNewDomainByDealer((current) => ({ ...current, [variables.dealerId]: "" }));
      toast({ title: "Domain angelegt" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Domain konnte nicht angelegt werden.",
        variant: "destructive",
      });
    },
  });

  const activateDomainMutation = useMutation({
    mutationFn: ({ domainId, status }: { domainId: string; status: DealerDomainStatus }) =>
      api.put(`/api/admin/domains/${domainId}/activate`, {
        status: status === "active" ? "active" : "disabled",
        isPrimary: status === "active",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dealers"] });
      toast({ title: "Domain aktualisiert" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Domain konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: (domainId: string) => api.delete(`/api/admin/domains/${domainId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dealers"] });
      toast({ title: "Domain entfernt" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Domain konnte nicht entfernt werden.",
        variant: "destructive",
      });
    },
  });

  const updateInquiryStatusMutation = useMutation({
    mutationFn: ({ inquiryId, status }: { inquiryId: string; status: "new" | "in_progress" | "converted" | "archived" }) =>
      api.patch(`/api/admin/inquiries/${inquiryId}`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] });
      toast({ title: "Anfrage aktualisiert" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Anfrage konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (dealer: Dealer) => {
    setEditingDealer(dealer);
    setEditForm(createEditForm(dealer));
  };

  const loadInquiryIntoCreateForm = (inquiry: Inquiry) => {
    setSelectedInquiryId(inquiry.id);
    setNewDealer({
      name: inquiry.businessName,
      slug: "",
      ownerName: inquiry.contactName,
      ownerEmail: inquiry.email,
      ownerUsername: generateUsernameFromInquiry(inquiry),
      ownerPassword: generateTemporaryPassword(),
    });
    createDealerCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (session?.user.platformRole !== "platform_super_admin") {
    return <div className="text-sm text-muted-foreground">Kein Zugriff auf diese Seite.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-6 text-slate-50">
        <div className="text-sm uppercase tracking-[0.2em] text-cyan-200/80">Plattform</div>
        <h1 className="mt-2 text-3xl font-semibold">Autohaeuser verwalten</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Hier legst du neue Firmen an, bearbeitest Owner-Zugangsdaten, passt Status und Tarif an und kannst Autohaeuser auch wieder entfernen.
        </p>
      </div>

      <Card ref={createDealerCardRef}>
        <CardHeader>
          <CardTitle>Neues Autohaus</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {selectedInquiryId ? (
            <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm text-cyan-950 md:col-span-2 dark:text-cyan-50">
              Anfrage wird gerade in die Neuanlage uebernommen. Pruefe Username und Startpasswort vor dem Anlegen.
            </div>
          ) : null}
          {[
            ["name", "Dealer-Name"],
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
              "Dealer anlegen"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dealer-Übersicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(dealersQuery.data ?? []).map((dealer) => {
            const owner = getPrimaryOwner(dealer);
            const isDeleting = deleteDealerMutation.isPending && deleteDealerMutation.variables === dealer.id;

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
                    <div className="mt-3 space-y-2 rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">Domains</div>
                      {dealer.domains.length === 0 ? <div>Noch keine Domains hinterlegt.</div> : null}
                      {dealer.domains.map((domain) => (
                        <div key={domain.id} className="rounded-md border bg-background/70 p-3">
                          <div className="font-mono text-xs text-foreground">{domain.host}</div>
                          <div className="mt-1 text-xs">
                            {domain.status}
                            {domain.isPrimary ? " • Primaer" : ""}
                            {domain.verifiedAt ? ` • verifiziert ${new Date(domain.verifiedAt).toLocaleDateString("de-DE")}` : ""}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                activateDomainMutation.mutate({
                                  domainId: domain.id,
                                  status: domain.status === "active" ? "disabled" : "active",
                                })
                              }
                            >
                              {domain.status === "active" ? "Deaktivieren" : "Aktivieren"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteDomainMutation.mutate(domain.id)}
                            >
                              Entfernen
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          placeholder="app.kunde.de"
                          value={newDomainByDealer[dealer.id] ?? ""}
                          onChange={(event) =>
                            setNewDomainByDealer((current) => ({
                              ...current,
                              [dealer.id]: event.target.value,
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            createDomainMutation.mutate({
                              dealerId: dealer.id,
                              host: newDomainByDealer[dealer.id] ?? "",
                            })
                          }
                          disabled={!newDomainByDealer[dealer.id]?.trim() || createDomainMutation.isPending}
                        >
                          Domain anlegen
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid w-full gap-3 xl:w-[320px]">
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
                      Login-Link fuer Haendler: <span className="font-mono">/login</span>
                      <br />
                      Admin-Link fuer dich: <span className="font-mono">/admin/login</span>
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
                    <SelectItem value="ready_for_dns">Ready for DNS</SelectItem>
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

      <Card>
        <CardHeader>
          <CardTitle>Neue White-Label-Anfragen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(inquiriesQuery.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">Noch keine Anfragen eingegangen.</div>
          ) : (
            (inquiriesQuery.data ?? []).map((inquiry) => (
              <div key={inquiry.id} className="rounded-lg border p-4">
                <div className="font-medium">{inquiry.businessName}</div>
                <div className="text-sm text-muted-foreground">
                  {inquiry.contactName} • {inquiry.email}
                  {inquiry.phone ? ` • ${inquiry.phone}` : ""}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Status: {inquiry.status} • Eingang: {new Date(inquiry.createdAt).toLocaleString("de-DE")}
                </div>
                {inquiry.website ? (
                  <div className="text-sm text-muted-foreground">{inquiry.website}</div>
                ) : null}
                {inquiry.notes ? <div className="mt-2 text-sm">{inquiry.notes}</div> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => loadInquiryIntoCreateForm(inquiry)}>
                    In Neuanlage uebernehmen
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      updateInquiryStatusMutation.mutate({
                        inquiryId: inquiry.id,
                        status: inquiry.status === "new" ? "in_progress" : "new",
                      })
                    }
                  >
                    {inquiry.status === "new" ? "Als in Bearbeitung markieren" : "Auf neu zuruecksetzen"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
