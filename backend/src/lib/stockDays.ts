const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function calculateStockDays(
  purchaseDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined = new Date()
): number | null {
  if (!purchaseDate || !endDate) return null;
  const start = new Date(purchaseDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.floor((startOfUtcDay(end) - startOfUtcDay(start)) / DAY_MS));
}
