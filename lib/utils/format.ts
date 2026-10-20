import { APP_TIMEZONE, daysBetween, startOfToday } from "./date";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: APP_TIMEZONE,
});

const dayInTimezoneFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIMEZONE });

/** "2 Nov 2026" for a moment in time (completedAt, updatedAt…), as the calendar day in the company's timezone. */
export function formatDay(date: Date | string | null | undefined) {
  return date ? dayInTimezoneFormat.format(new Date(date)) : "—";
}

/** "2 Nov 2026" for calendar dates (DATE columns like due and joining dates, which come back as 00:00 UTC). */
export function formatDate(date: Date | string | null | undefined) {
  return date ? dateFormat.format(new Date(date)) : "—";
}

const shortDateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** "21 Oct" for dates this year, "21 Oct 2027" otherwise. For tight spaces. */
export function formatShortDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = new Date(date);
  return d.getUTCFullYear() === startOfToday().getUTCFullYear() ? shortDateFormat.format(d) : dateFormat.format(d);
}

/** "2 Nov 2026, 3:45 pm" in the company's timezone, for timestamps. */
export function formatDateTime(date: Date | string | null | undefined) {
  return date ? dateTimeFormat.format(new Date(date)) : "—";
}

/** "Today", "Tomorrow", "In 3 days", "2 days ago" for a calendar date. */
export function formatRelativeDay(date: Date | string | null | undefined) {
  if (!date) return "—";
  const days = daysBetween(startOfToday(), new Date(date));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

/** "Just now", "5 min ago", "3 h ago", or a date for older timestamps. */
export function formatTimeAgo(date: Date | string) {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return formatDay(date);
}

/** "PS" for "Priya Sharma". */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** "2.4 MB" */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "3 tasks", "1 task" */
export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** "Same day", "1 day", "12 days" for a duration in whole days. */
export function formatDays(days: number) {
  return days === 0 ? "Same day" : plural(days, "day");
}
