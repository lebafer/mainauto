import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Building2, LogOut, Menu, ShieldCheck } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { to: "/admin/dealers", label: "Autohäuser", icon: Building2 },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navContent = (
    <nav className="space-y-2">
      {navItems.map((item) => {
        const active = location.pathname === item.to;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileNavOpen(false)}
            className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
              active ? "bg-cyan-400/15 text-cyan-200" : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_45%),linear-gradient(to_bottom,#09090b,#111827)] text-white">
      <header className="border-b border-white/10 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {isMobile ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMobileNavOpen(true)}
                className="h-10 w-10 text-white hover:bg-white/10 hover:text-white lg:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Navigation öffnen</span>
              </Button>
            ) : null}
            <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-2">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">CarOps SaaS</div>
              <div className="text-lg font-semibold">Superadmin</div>
            </div>
          </div>
          <Button variant="ghost" onClick={() => signOut()} className="text-white hover:bg-white/10 hover:text-white">
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </Button>
        </div>
      </header>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="border-white/10 bg-slate-950/95 p-4 text-white sm:max-w-sm">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Navigation</div>
            <div className="mt-1 text-lg font-semibold">Superadmin</div>
          </div>
          {navContent}
        </SheetContent>
      </Sheet>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        <aside className="hidden rounded-2xl border border-white/10 bg-white/5 p-3 lg:block">
          {navContent}
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
