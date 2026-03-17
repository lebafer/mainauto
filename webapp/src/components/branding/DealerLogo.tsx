import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { getFileUrl } from "@/lib/vehicles";
import { cn } from "@/lib/utils";

interface DealerLogoProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  placeholderClassName?: string;
  showPlaceholder?: boolean;
}

function brightenDarkNeutralPixels(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;

        if (!canvas.width || !canvas.height) {
          resolve(source);
          return;
        }

        const context = canvas.getContext("2d");
        if (!context) {
          resolve(source);
          return;
        }

        context.drawImage(image, 0, 0);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = frame;

        for (let index = 0; index < data.length; index += 4) {
          const alpha = data[index + 3];
          if (alpha < 16) {
            continue;
          }

          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];
          const max = Math.max(red, green, blue);
          const min = Math.min(red, green, blue);
          const saturation = max - min;
          const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

          if (saturation <= 34 && luminance < 142) {
            const lifted = luminance < 88 ? 255 : 236;
            data[index] = lifted;
            data[index + 1] = lifted;
            data[index + 2] = lifted;
          }
        }

        context.putImageData(frame, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => reject(new Error("Logo konnte nicht verarbeitet werden."));
    image.src = source;
  });
}

export function DealerLogo({
  src,
  alt,
  className,
  imgClassName,
  placeholderClassName,
  showPlaceholder = true,
}: DealerLogoProps) {
  const { resolvedTheme } = useTheme();
  const normalizedSrc = src ? getFileUrl(src) : null;
  const [displaySrc, setDisplaySrc] = useState<string | null>(normalizedSrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [normalizedSrc]);

  useEffect(() => {
    let cancelled = false;

    if (!normalizedSrc) {
      setDisplaySrc(null);
      return () => {
        cancelled = true;
      };
    }

    if (resolvedTheme !== "dark") {
      setDisplaySrc(normalizedSrc);
      return () => {
        cancelled = true;
      };
    }

    brightenDarkNeutralPixels(normalizedSrc)
      .then((processedSrc) => {
        if (!cancelled) {
          setDisplaySrc(processedSrc);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDisplaySrc(normalizedSrc);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSrc, resolvedTheme]);

  if (!normalizedSrc || failed || !displaySrc) {
    if (!showPlaceholder) {
      return null;
    }

    return (
      <div className={cn("flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground", className, placeholderClassName)}>
        <ImageOff className="mr-2 h-4 w-4 shrink-0 group-data-[collapsible=icon]:mr-0" />
        <span className="group-data-[collapsible=icon]:hidden">Kein Logo</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <img
        src={displaySrc}
        alt={alt}
        className={cn("h-full w-full object-contain", imgClassName)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
