import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const COST_TYPE_PRESETS = [
  "Lackierung",
  "Reifen",
  "Dübel",
  "HU/AU",
  "Inspektion",
  "Sonstiges",
];

interface AddCostDialogProps {
  vehicleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCostDialog({ vehicleId, open, onOpenChange }: AddCostDialogProps) {
  const queryClient = useQueryClient();
  const [costType, setCostType] = useState("");
  const [customCostType, setCustomCostType] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const isCustom = costType === "__custom__";
  const resolvedCostType = isCustom ? customCostType : costType;

  const addCostMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/vehicles/${vehicleId}/costs`, {
        costType: resolvedCostType,
        amount: parseFloat(amount),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      toast.success("Kosten hinzugefügt");
      handleClose();
    },
    onError: () => {
      toast.error("Fehler beim Hinzufügen der Kosten");
    },
  });

  function handleClose() {
    onOpenChange(false);
    setCostType("");
    setCustomCostType("");
    setAmount("");
    setNotes("");
  }

  const isValid =
    resolvedCostType.trim().length > 0 &&
    amount.trim().length > 0 &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Kosten hinzufügen</DialogTitle>
          <DialogDescription>
            Zusatzkosten für dieses Fahrzeug erfassen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cost type */}
          <div className="space-y-2">
            <Label>Kostenart</Label>
            <Select value={costType} onValueChange={setCostType}>
              <SelectTrigger>
                <SelectValue placeholder="Kostenart wählen..." />
              </SelectTrigger>
              <SelectContent>
                {COST_TYPE_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {preset}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__">Sonstige (eigene Eingabe)</SelectItem>
              </SelectContent>
            </Select>

            {isCustom ? (
              <Input
                placeholder="Kostenart eingeben..."
                value={customCostType}
                onChange={(e) => setCustomCostType(e.target.value)}
                autoFocus
              />
            ) : null}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Betrag (EUR)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                €
              </span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notizen <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              rows={2}
              placeholder="Beschreibung, Lieferant, Bemerkungen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button
            disabled={!isValid || addCostMutation.isPending}
            onClick={() => addCostMutation.mutate()}
          >
            {addCostMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            Hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
