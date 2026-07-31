export const BUSINESS_TIME_ZONE = "Europe/Berlin";

export function formatBusinessDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getBusinessCalendarYear(date: Date): number {
  const year = new Intl.DateTimeFormat("en", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
  }).format(date);
  return Number(year);
}
