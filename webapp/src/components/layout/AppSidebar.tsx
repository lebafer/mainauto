import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  Users,
  Receipt,
  LogOut,
  Truck,
  BarChart2,
  CreditCard,
  Building2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-client";
import { CarOpsLogo } from "@/components/branding/CarOpsLogo";
import { DealerLogo } from "@/components/branding/DealerLogo";

export function AppSidebar() {
  const location = useLocation();
  const { session } = useAuth();
  const canManageBusiness = ["dealer_owner", "dealer_admin"].includes(
    session?.dealerRole ?? ""
  );

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/vehicles", label: "Fahrzeuge", icon: Car },
    { to: "/customers", label: "Kunden", icon: Users },
    { to: "/suppliers", label: "Lieferanten", icon: Truck },
    { to: "/sales", label: "Verkäufe", icon: Receipt },
    ...(canManageBusiness
      ? [
          { to: "/finances", label: "Finanzen", icon: BarChart2 },
          { to: "/billing", label: "Tarif", icon: CreditCard },
          { to: "/settings/dealer", label: "Unternehmen", icon: Building2 },
          ...(session?.entitlements?.team_management ? [{ to: "/settings/team", label: "Team", icon: Users }] : []),
        ]
      : []),
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border"
      style={{
        background:
          "linear-gradient(180deg, rgb(var(--tenant-accent-rgb) / 0.98) 0%, rgb(var(--tenant-accent-rgb) / 0.88) 24%, hsl(var(--sidebar-background)) 48%)",
        boxShadow: "inset 2px 0 0 rgb(var(--tenant-primary-rgb) / 0.65)",
      }}
    >
      <SidebarHeader className="h-24 overflow-hidden p-0">
        <div className="flex h-full w-full items-center justify-center bg-sidebar px-4">
          {session?.dealerSettings?.logoUrl ? (
            <DealerLogo
              src={session.dealerSettings.logoUrl}
              alt={`${session.dealerSettings.displayName ?? session.dealer?.name ?? "Autohaus"} Logo`}
              className="h-16 w-full group-data-[collapsible=icon]:h-10"
              showPlaceholder={false}
            />
          ) : (
            <CarOpsLogo
              compact={false}
              className="group-data-[collapsible=icon]:[&>div:last-child]:hidden"
            />
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  location.pathname === item.to ||
                  (item.to !== "/dashboard" &&
                    location.pathname.startsWith(item.to));

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <NavLink to={item.to}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <div
          className="rounded-lg px-3 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"
          style={{ background: "rgba(96,145,209,0.10)" }}
        >
          <div className="font-medium text-foreground">
            {session?.dealerSettings?.displayName ?? session?.dealer?.name ?? "Autohaus"}
          </div>
          <div>
            {session?.billing.isComplimentary
              ? `${session?.subscription?.plan?.name ?? "Tarif"} kostenlos`
              : session?.subscription?.plan?.name ?? "Kein Tarif"}
          </div>
        </div>
        <div className="flex items-center justify-between px-1 py-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-11 w-11 text-muted-foreground hover:text-destructive"
            title="Abmelden"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Abmelden</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
