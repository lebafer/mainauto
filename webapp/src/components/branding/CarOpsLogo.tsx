import { cn } from "@/lib/utils";

interface CarOpsLogoProps {
  className?: string;
  compact?: boolean;
}

export function CarOpsLogo({ className, compact = false }: CarOpsLogoProps) {
  return (
    <img
      src="/carops_logo.png"
      alt="CarOps"
      className={cn(
        "h-auto w-auto object-contain",
        compact ? "max-h-24 max-w-[20rem]" : "max-h-36 max-w-[28rem]",
        className
      )}
    />
  );
}
