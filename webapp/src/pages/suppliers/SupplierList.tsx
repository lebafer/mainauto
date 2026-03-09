import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Search, Truck, Building2, User } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface SupplierVehicle {
  id: string;
}

interface Supplier {
  id: string;
  name: string;
  supplierType: "privat" | "gewerblich";
  address?: string | null;
  country?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  phone2?: string | null;
  email?: string | null;
  website?: string | null;
  iban?: string | null;
  notes?: string | null;
  vehicles?: SupplierVehicle[];
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function SupplierList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers-db"],
    queryFn: () => api.get<Supplier[]>("/api/suppliers-db"),
  });

  const filtered = suppliers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.contactPerson ?? "").toLowerCase().includes(q) ||
      (s.country ?? "").toLowerCase().includes(q) ||
      (s.phone ?? "").toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
            <Truck className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lieferanten</h1>
            <p className="text-muted-foreground">
              {suppliers.length} Lieferant{suppliers.length !== 1 ? "en" : ""} gesamt
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to="/suppliers/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Neuer Lieferant
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Lieferanten suchen..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Truck className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? "Keine Lieferanten gefunden" : "Noch keine Lieferanten angelegt"}
          </p>
          {!search ? (
            <Button asChild variant="ghost" className="mt-3">
              <Link to="/suppliers/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Ersten Lieferanten anlegen
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="hidden md:table-cell">Land</TableHead>
                <TableHead className="hidden lg:table-cell">Ansprechpartner</TableHead>
                <TableHead className="hidden md:table-cell">Telefon</TableHead>
                <TableHead className="text-right">Fahrzeuge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((supplier) => (
                <TableRow
                  key={supplier.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/suppliers/${supplier.id}`)}
                >
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>
                    {supplier.supplierType === "gewerblich" ? (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1">
                        <Building2 className="h-3 w-3" />
                        Gewerblich
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
                        <User className="h-3 w-3" />
                        Privat
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {supplier.country ?? "--"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {supplier.contactPerson ?? "--"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {supplier.phone ?? "--"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">
                      {supplier.vehicles?.length ?? 0}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
