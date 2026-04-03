import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, RefreshCcw, Trash2 } from "lucide-react";
import type {
  DealerWebsiteFeedTokenCreateResponse,
  DealerWebsiteFeedTokenStatus,
} from "../../../../backend/src/types";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DealerWebsiteFeedCardProps {
  canManage: boolean;
}

export function DealerWebsiteFeedCard({ canManage }: DealerWebsiteFeedCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [latestToken, setLatestToken] = useState<DealerWebsiteFeedTokenCreateResponse | null>(null);

  const feedQuery = useQuery({
    queryKey: ["dealer-website-feed"],
    queryFn: () => api.get<DealerWebsiteFeedTokenStatus>("/api/settings/website-feed"),
    enabled: canManage,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post<DealerWebsiteFeedTokenCreateResponse>("/api/settings/website-feed/token"),
    onSuccess: async (data) => {
      setLatestToken(data);
      await queryClient.invalidateQueries({ queryKey: ["dealer-website-feed"] });
      toast({
        title: "Token erstellt",
        description: "Der neue Website-API-Token wurde erzeugt und der alte sofort ersetzt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Token konnte nicht erstellt werden.",
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => api.delete<{ success: boolean }>("/api/settings/website-feed/token"),
    onSuccess: async () => {
      setLatestToken(null);
      await queryClient.invalidateQueries({ queryKey: ["dealer-website-feed"] });
      toast({
        title: "Token widerrufen",
        description: "Die Händler-Website kann den Fahrzeugfeed mit dem alten Token nicht mehr abrufen.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Token konnte nicht widerrufen werden.",
        variant: "destructive",
      });
    },
  });

  const tokenStatus = feedQuery.data;
  const tokenUpdatedLabel = useMemo(() => {
    if (!tokenStatus?.updatedAt) {
      return "Noch kein Token erzeugt";
    }

    return new Date(tokenStatus.updatedAt).toLocaleString("de-DE");
  }, [tokenStatus?.updatedAt]);

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} kopiert` });
    } catch {
      toast({
        title: "Kopieren fehlgeschlagen",
        description: `${label} konnte nicht in die Zwischenablage kopiert werden.`,
        variant: "destructive",
      });
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Haendler-Website API</CardTitle>
          <CardDescription>
            Liefert freigegebene Fahrzeuge inklusive Bilder fuer externe Webseiten per Bearer-Token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {tokenStatus && tokenStatus.enabled ? null : (
            <Alert>
              <AlertTitle>Pro-Feature</AlertTitle>
              <AlertDescription>
                Diese Funktion muss im Adminbereich fuer dein Autohaus freigeschaltet sein, bevor ein Token erzeugt werden kann.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">Feed-URL</div>
              <div className="break-all text-sm text-muted-foreground">
                {tokenStatus?.feedUrl ?? "Wird geladen..."}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">Token-Status</div>
              <div className="text-sm text-muted-foreground">
                {tokenStatus?.hasToken ? `Aktiv (${tokenStatus.tokenPreview})` : "Kein aktiver Token"}
              </div>
              <div className="text-xs text-muted-foreground">
                Zuletzt aktualisiert: {tokenUpdatedLabel}
                {tokenStatus?.lastUsedAt ? ` • Letzte Nutzung: ${new Date(tokenStatus.lastUsedAt).toLocaleString("de-DE")}` : ""}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-4">
            <div className="text-sm font-medium text-foreground">Integration</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Die Website ruft den Feed serverseitig mit <code>Authorization: Bearer &lt;TOKEN&gt;</code> auf. Bild-URLs im Feed sind bereits absolut.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={!tokenStatus?.enabled || generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Erzeugt...
                </>
              ) : tokenStatus?.hasToken ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Token neu erzeugen
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Token erzeugen
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => tokenStatus?.feedUrl && copyText(tokenStatus.feedUrl, "Feed-URL")}
              disabled={!tokenStatus?.feedUrl}
            >
              <Copy className="mr-2 h-4 w-4" />
              Feed-URL kopieren
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => revokeMutation.mutate()}
              disabled={!tokenStatus?.hasToken || revokeMutation.isPending}
            >
              {revokeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Widerruft...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Token widerrufen
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={latestToken !== null} onOpenChange={(open) => (!open ? setLatestToken(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Website-Token</DialogTitle>
            <DialogDescription>
              Dieser Token wird nur jetzt im Klartext angezeigt. Bewahre ihn sicher auf und hinterlege ihn auf der Händler-Webseite.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="website-feed-url">Feed-URL</Label>
              <div className="flex gap-2">
                <Input id="website-feed-url" value={latestToken?.feedUrl ?? ""} readOnly />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => latestToken?.feedUrl && copyText(latestToken.feedUrl, "Feed-URL")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website-feed-token">Bearer-Token</Label>
              <div className="flex gap-2">
                <Input id="website-feed-token" value={latestToken?.token ?? ""} readOnly />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => latestToken?.token && copyText(latestToken.token, "Token")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setLatestToken(null)}>
              Verstanden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
