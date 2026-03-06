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

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/vehicles": "Fahrzeuge",
  "/vehicles/new": "Neues Fahrzeug",
  "/customers": "Kunden",
  "/customers/new": "Neuer Kunde",
  "/sales": "Verkaufe",
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

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {parent ? (
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
                  <BreadcrumbPage>{current}</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
