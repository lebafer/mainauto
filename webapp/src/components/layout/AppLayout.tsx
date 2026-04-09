import { useLocation } from "react-router-dom";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/vehicles": "Fahrzeuge",
  "/vehicles/new": "Neues Fahrzeug",
  "/customers": "Kunden",
  "/customers/new": "Neuer Kunde",
  "/sales": "Verkäufe",
  "/suppliers": "Lieferanten",
  "/suppliers/new": "Neuer Lieferant",
  "/finances": "Finanzen",
  "/billing": "Tarif & Abrechnung",
  "/settings/dealer": "Unternehmen & Dokumente",
  "/settings/team": "Teamverwaltung",
  "/admin/dealers": "Super-Admin",
};

function getPageTitle(pathname: string): { parent?: string; current: string } {
  // Check for exact match first
  if (pageTitles[pathname]) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length > 1 && pageTitles["/" + parts[0]]) {
      return {
        parent: pageTitles["/" + parts[0]],
        current: pageTitles[pathname],
      };
    }
    return { current: pageTitles[pathname] };
  }

  // Handle dynamic routes like /vehicles/:id, /vehicles/:id/edit
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const basePath = "/" + parts[0];
    const parentTitle = pageTitles[basePath];
    if (parentTitle) {
      if (parts.length === 3 && parts[2] === "edit") {
        return { parent: parentTitle, current: "Bearbeiten" };
      }
      return { parent: parentTitle, current: "Details" };
    }
  }

  return { current: "Seite" };
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const { parent, current } = getPageTitle(location.pathname);
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="relative flex min-h-14 shrink-0 items-center gap-2 border-b px-3 py-2 sm:h-14 sm:px-4">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgb(var(--tenant-primary-rgb) / 0.85), transparent)" }}
          />
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 hidden h-4 sm:block" />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList>
              {!isMobile && parent ? (
                <>
                  <BreadcrumbItem>
                    <span className="text-muted-foreground">{parent}</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{current}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage className="truncate">{current}</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
