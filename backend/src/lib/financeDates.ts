const BERLIN_TIME_ZONE = "Europe/Berlin";

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days))
    .toISOString()
    .slice(0, 10);
}

function timeZoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const representedAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  );
  return representedAsUtc - Math.floor(at.getTime() / 1000) * 1000;
}

export function berlinStartOfDayUtc(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const localMidnightAsUtc = Date.UTC(year!, month! - 1, day!);
  let candidate = localMidnightAsUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    candidate =
      localMidnightAsUtc -
      timeZoneOffsetMs(new Date(candidate), BERLIN_TIME_ZONE);
  }
  return new Date(candidate);
}

export function getBerlinDateRange(input: {
  from?: string;
  to?: string;
}): { fromDate?: Date; toDateExclusive?: Date } {
  const fromDate = input.from ? berlinStartOfDayUtc(input.from) : undefined;
  const toDateExclusive = input.to
    ? berlinStartOfDayUtc(addCalendarDays(input.to, 1))
    : undefined;
  return { fromDate, toDateExclusive };
}
