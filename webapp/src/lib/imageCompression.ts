const DEFAULT_MAX_LONG_EDGE = 1920;
const DEFAULT_JPEG_QUALITY = 0.82;
const DEFAULT_RECOMPRESS_BYTES = 2.5 * 1024 * 1024;

export type ImageDimensions = {
  width: number;
  height: number;
};

export type ImageResizeInput = ImageDimensions & {
  fileSize: number;
};

export function getResizedImageDimensions(
  width: number,
  height: number,
  maxLongEdge = DEFAULT_MAX_LONG_EDGE
): ImageDimensions {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxLongEdge) {
    return { width, height };
  }

  const scale = maxLongEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function shouldDownscaleImage(
  image: ImageResizeInput,
  maxLongEdge = DEFAULT_MAX_LONG_EDGE,
  recompressBytes = DEFAULT_RECOMPRESS_BYTES
): boolean {
  return (
    Math.max(image.width, image.height) > maxLongEdge ||
    image.fileSize > recompressBytes
  );
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    return window.createImageBitmap(file, { imageOrientation: "from-image" });
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bild konnte nicht gelesen werden"));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Bild konnte nicht komprimiert werden"));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

export async function optimizeImageForVehicleUpload(
  file: File,
  options: {
    maxLongEdge?: number;
    quality?: number;
    recompressBytes?: number;
  } = {}
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  const maxLongEdge = options.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE;
  const quality = options.quality ?? DEFAULT_JPEG_QUALITY;
  const recompressBytes = options.recompressBytes ?? DEFAULT_RECOMPRESS_BYTES;

  const decoded = await decodeImage(file);
  const sourceWidth = decoded instanceof HTMLImageElement ? decoded.naturalWidth : decoded.width;
  const sourceHeight = decoded instanceof HTMLImageElement ? decoded.naturalHeight : decoded.height;

  if (
    !shouldDownscaleImage(
      { width: sourceWidth, height: sourceHeight, fileSize: file.size },
      maxLongEdge,
      recompressBytes
    )
  ) {
    if ("close" in decoded) decoded.close();
    return file;
  }

  const { width, height } = getResizedImageDimensions(sourceWidth, sourceHeight, maxLongEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    if ("close" in decoded) decoded.close();
    return file;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(decoded, 0, 0, width, height);
  if ("close" in decoded) decoded.close();

  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  if (blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "fahrzeugbild";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
