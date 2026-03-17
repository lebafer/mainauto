import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  Users,
  Receipt,
  LogOut,
  Truck,
  BarChart2,
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
import { DealerLogo } from "@/components/branding/DealerLogo";

export function AppSidebar() {
  const location = useLocation();
  const { session, tenant } = useAuth();

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/vehicles", label: "Fahrzeuge", icon: Car },
    { to: "/customers", label: "Kunden", icon: Users },
    { to: "/suppliers", label: "Lieferanten", icon: Truck },
    { to: "/sales", label: "Verkäufe", icon: Receipt },
    { to: "/finances", label: "Finanzen", icon: BarChart2 },
    ...(session?.dealerRole && ["dealer_owner", "dealer_admin"].includes(session.dealerRole)
      ? [
          { to: "/settings/dealer", label: "Händler", icon: Users },
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
          "linear-gradient(180deg, rgb(var(--tenant-accent-rgb) / 0.26) 0%, rgb(var(--tenant-primary-rgb) / 0.08) 18%, hsl(var(--sidebar-background)) 34%)",
        boxShadow: "inset 2px 0 0 rgb(var(--tenant-primary-rgb) / 0.55)",
      }}
    >
      <SidebarHeader className="h-24 overflow-hidden p-0">
        <div className="flex h-full w-full items-center justify-center bg-sidebar px-4">
          <DealerLogo
            src={session?.dealerSettings?.logoUrl}
            alt={session?.dealer?.name ?? "Dealer Logo"}
            className="h-16 w-full max-w-[220px] group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:max-w-[40px]"
            placeholderClassName="border-sidebar-border bg-muted/20 group-data-[collapsible=icon]:rounded-full"
          />
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
          style={{ background: "rgb(var(--tenant-primary-rgb) / 0.10)" }}
        >
          <div className="font-medium text-foreground">
            {session?.dealerSettings?.displayName ?? session?.dealer?.name ?? tenant?.displayName ?? "Autohaus Hub"}
          </div>
          <div>{session?.subscription?.plan?.name ?? "Kein Tarif"}</div>
        </div>
        <div className="flex items-center justify-between px-1 py-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
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
