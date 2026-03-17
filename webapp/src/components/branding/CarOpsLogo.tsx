import { cn } from "@/lib/utils";

interface CarOpsLogoProps {
  className?: string;
  compact?: boolean;
}

export function CarOpsLogo({ className, compact = false }: CarOpsLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/30 bg-[radial-gradient(circle_at_30%_30%,rgba(251,191,36,0.95),rgba(217,119,6,0.85)_55%,rgba(15,23,42,1))] shadow-[0_20px_40px_-20px_rgba(245,158,11,0.65)]">
        <div className="h-4 w-4 rounded-sm border border-white/60 bg-white/20" />
        <div className="absolute -right-1 top-1 h-3 w-3 rounded-full bg-slate-950/80 ring-2 ring-amber-300/70" />
      </div>
      {compact ? null : (
        <div className="leading-none">
          <div className="font-semibold tracking-[0.24em] text-slate-950 dark:text-white">CAROPS</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Das Betriebssystem für dein Autohaus
          </div>
        </div>
      )}
    </div>
  );
}
