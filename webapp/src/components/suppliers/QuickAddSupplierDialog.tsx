import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const QuickSupplierSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  supplierType: z.enum(["privat", "gewerblich"]).default("gewerblich"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .email("Ungültige E-Mail-Adresse")
    .optional()
    .or(z.literal("")),
});

type QuickSupplierValues = z.infer<typeof QuickSupplierSchema>;

interface Supplier {
  id: string;
  name: string;
  supplierType: string;
  contactPerson?: string | null;
  email?: string | null;
}

interface QuickAddSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSupplierCreated: (supplier: Supplier) => void;
}

export function QuickAddSupplierDialog({
  open,
  onOpenChange,
  onSupplierCreated,
}: QuickAddSupplierDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<QuickSupplierValues>({
    resolver: zodResolver(QuickSupplierSchema),
    defaultValues: {
      name: "",
      supplierType: "gewerblich",
      contactPerson: "",
      phone: "",
      email: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: QuickSupplierValues) =>
      api.post<Supplier>("/api/suppliers-db", data),
    onSuccess: (supplier) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers-db"] });
      onSupplierCreated(supplier);
      form.reset();
      onOpenChange(false);
    },
  });

  function handleSubmit(values: QuickSupplierValues) {
    createMutation.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Lieferanten anlegen</DialogTitle>
          <DialogDescription>
            Gib die wichtigsten Daten ein. Weitere Details kannst du später in der Lieferantenverwaltung ergänzen.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name / Firma *</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Autohaus Müller GmbH" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplierType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lieferantentyp</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="gewerblich">Gewerblich</SelectItem>
                      <SelectItem value="privat">Privat</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ansprechpartner</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Max Müller" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. +49 89 123456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="z.B. kontakt@beispiel.de" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {createMutation.isError && (
              <p className="text-sm text-destructive">
                Fehler beim Speichern. Bitte versuche es erneut.
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Lieferant speichern
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
