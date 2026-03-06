import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Search, Plus, Users, Building2, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string | null;
  vehicles: { id: string }[];
  createdAt: string;
}

function useCustomers(search: string) {
  return useQuery({
    queryKey: ["customers", search],
    queryFn: () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      return api.get<Customer[]>(`/api/customers${params}`);
    },
  });
}

function CustomerTableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-3 w-[150px]" />
          </div>
          <Skeleton className="h-4 w-[120px] hidden md:block" />
          <Skeleton className="h-4 w-[100px] hidden md:block" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Keine Kunden gefunden</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Es wurden keine Kunden gefunden. Legen Sie einen neuen Kunden an, um zu
        beginnen.
      </p>
      <Button asChild>
        <Link to="/customers/new">
          <Plus className="mr-2 h-4 w-4" />
          Neuer Kunde
        </Link>
      </Button>
    </div>
  );
}

export default function CustomerList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: customers, isLoading } = useCustomers(search);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kunden</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Kundendaten
          </p>
        </div>
        <Button asChild>
          <Link to="/customers/new">
            <Plus className="mr-2 h-4 w-4" />
            Neuer Kunde
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Name, E-Mail oder Firma suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <CustomerTableSkeleton />
          ) : !customers || customers.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead className="text-right">Fahrzeuge</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/customers/${customer.id}`)}
                      >
                        <TableCell className="font-medium">
                          {customer.firstName} {customer.lastName}
                        </TableCell>
                        <TableCell>
                          {customer.company ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Building2 className="h-3.5 w-3.5" />
                              {customer.company}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {customer.email || "--"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {customer.phone || "--"}
                        </TableCell>
                        <TableCell className="text-right">
                          {customer.vehicles?.length > 0 ? (
                            <Badge variant="secondary">
                              {customer.vehicles.length}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile list */}
              <div className="md:hidden divide-y">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="flex items-center gap-3 w-full p-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {customer.firstName[0]}
                      {customer.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {customer.company
                          ? customer.company
                          : customer.email || "Keine E-Mail"}
                      </p>
                    </div>
                    {customer.vehicles?.length > 0 ? (
                      <Badge variant="secondary" className="shrink-0">
                        {customer.vehicles.length} Fzg.
                      </Badge>
                    ) : null}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
