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
        compact ? "max-h-20 max-w-[16rem]" : "max-h-28 max-w-[24rem]",
        className
      )}
    />
  );
}
