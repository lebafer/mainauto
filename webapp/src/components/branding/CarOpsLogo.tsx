import { useId } from "react";
import { cn } from "@/lib/utils";

interface CarOpsLogoProps {
  className?: string;
  compact?: boolean;
}

export function CarOpsLogo({ className, compact = false }: CarOpsLogoProps) {
  const logoId = useId().replace(/:/g, "");
  const arrowGradientId = `${logoId}-arrow`;
  const gearGradientId = `${logoId}-gear`;
  const trackGradientId = `${logoId}-track`;

  return (
    <div className={cn("flex items-center gap-3.5", className)}>
      <svg
        viewBox="0 0 140 140"
        aria-hidden="true"
        className={cn(
          "shrink-0 drop-shadow-[0_18px_32px_rgba(15,23,42,0.14)]",
          compact ? "h-10 w-10" : "h-14 w-14",
        )}
      >
        <defs>
          <linearGradient id={arrowGradientId} x1="24" x2="116" y1="108" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="#12335d" />
            <stop offset="0.55" stopColor="#1f4f86" />
            <stop offset="1" stopColor="#6f8fb4" />
          </linearGradient>
          <linearGradient id={gearGradientId} x1="73" x2="118" y1="102" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0f2f58" />
            <stop offset="1" stopColor="#234f85" />
          </linearGradient>
          <linearGradient id={trackGradientId} x1="26" x2="63" y1="101" y2="39" gradientUnits="userSpaceOnUse">
            <stop stopColor="#133860" />
            <stop offset="1" stopColor="#8ca2bc" />
          </linearGradient>
        </defs>

        <g fill={`url(#${trackGradientId})`} opacity="0.95">
          <path d="M35 97c-5-16-5-33 0-49l9-8c-8 20-9 40-3 61l-6-4Z" />
          <path d="M43 92c-3-15-2-30 3-45l8-8c-7 18-8 36-4 55l-7-2Z" />
          <path d="M51 84c-2-12 0-24 5-35l8-7c-6 14-7 28-5 43l-8-1Z" />
          <path d="M41 83h13l-7 8H36l5-8Z" />
          <path d="M45 68h15l-8 8H40l5-8Z" />
          <path d="M50 53h15l-8 8H46l4-8Z" />
        </g>

        <g transform="translate(24 22)">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <rect
              key={angle}
              x="57"
              y="39"
              width="16"
              height="14"
              rx="4"
              fill={`url(#${gearGradientId})`}
              transform={`rotate(${angle} 65 65)`}
            />
          ))}
          <circle cx="65" cy="65" r="34" fill={`url(#${gearGradientId})`} />
          <circle cx="65" cy="65" r="19" fill="rgba(255,255,255,0.92)" />
        </g>

        <path
          d="M88 12 120 0l-9 32-10-10c-31 24-43 52-35 84 3 11 8 18 16 23-18 2-31-3-40-16-11-16-12-36-4-59 8-23 24-41 47-54l-9-8Z"
          fill={`url(#${arrowGradientId})`}
        />
      </svg>
      {compact ? null : (
        <div className="leading-none">
          <div className="text-[1.95rem] font-black tracking-[0.16em] text-[#153f73] dark:text-[#d8e7fb]">CAROPS</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
            Das Betriebssystem für dein Autohaus
          </div>
        </div>
      )}
    </div>
  );
}
