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

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vehicles", label: "Fahrzeuge", icon: Car },
  { to: "/customers", label: "Kunden", icon: Users },
  { to: "/suppliers", label: "Lieferanten", icon: Truck },
  { to: "/sales", label: "Verkaufe", icon: Receipt },
  { to: "/finances", label: "Finanzen", icon: BarChart2 },
];

export function AppSidebar() {
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-16 overflow-hidden p-0">
        <div className="h-full w-full flex items-center justify-center">
          <img
            src="/mainauto-logo-light.png"
            alt="MainAuto Logo"
            style={{ transform: "scale(2)" }}
            className="h-10 w-auto object-contain group-data-[collapsible=icon]:scale-100 group-data-[collapsible=icon]:h-8 dark:hidden"
          />
          <img
            src="/mainauto-logo-dark.png"
            alt="MainAuto Logo"
            style={{ transform: "scale(2)" }}
            className="h-10 w-auto object-contain group-data-[collapsible=icon]:scale-100 group-data-[collapsible=icon]:h-8 hidden dark:block"
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
