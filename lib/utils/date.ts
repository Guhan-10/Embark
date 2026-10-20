const DAY_MS = 24 * 60 * 60 * 1000;

/** The company's timezone. Due dates and expiry dates are calendar days in this zone. */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata";

/**
 * Today's date in the company's timezone, as 00:00 UTC on that date —
 * the form Postgres DATE columns (due dates, expiry dates) come back in.
 */
export function startOfToday(now = new Date(), timeZone = APP_TIMEZONE) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole calendar days from a to b (negative if b is earlier). */
export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfToday(b).getTime() - startOfToday(a).getTime()) / DAY_MS);
}

/** YYYY-MM-DD for a DATE value, e.g. for keys and file names. */
export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** The moment a calendar day (YYYY-MM-DD) starts in the company's timezone, e.g. for "from" date filters. */
export function startOfDayInZone(ymd: string, timeZone = APP_TIMEZONE) {
  const utc = new Date(`${ymd}T00:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const zoned = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(utc.getTime() - (zoned - utc.getTime()));
}
