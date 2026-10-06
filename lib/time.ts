/**
 * Dates and times in Wichita (America/Chicago), whatever the viewer's or server's own zone.
 * Stored as UTC timestamps; every display and every "which day is this" goes through here.
 * Day keys are "YYYY-MM-DD" strings in Wichita time, safe to compare and sort as text.
 */
export const TZ = "America/Chicago";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 Sunday .. 6 Saturday
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function zoned(date: Date): ZonedParts {
  const p: Record<string, string> = {};
  for (const { type, value } of partsFmt.formatToParts(date)) p[type] = value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday ?? "Sun"),
  };
}

/** The UTC instant for a wall-clock time in Wichita. Handles daylight saving both ways. */
export function fromZoned(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = (t: number) => {
    const z = zoned(new Date(t));
    return Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute) - t;
  };
  let t = guess - offset(guess);
  const second = guess - offset(t);
  if (second !== t) t = second;
  return new Date(t);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(date: Date): string {
  const z = zoned(date);
  return `${z.year}-${pad(z.month)}-${pad(z.day)}`;
}

export function parseDayKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

/** Adds whole calendar days to a day key (no time zone drift: pure date arithmetic). */
export function addDays(key: string, n: number): string {
  const { year, month, day } = parseDayKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function weekdayOfKey(key: string): number {
  const { year, month, day } = parseDayKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Monday of the week containing the day key. */
export function startOfWeek(key: string): string {
  const wd = weekdayOfKey(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export function startOfDay(key: string): Date {
  const { year, month, day } = parseDayKey(key);
  return fromZoned(year, month, day, 0, 0);
}

export const todayKey = () => dayKey(new Date());

/** "2026-10-14T18:00" in Wichita time, for <input type="datetime-local">. */
export function toLocalInput(date: Date | null | undefined): string {
  if (!date) return "";
  const z = zoned(date);
  return `${z.year}-${pad(z.month)}-${pad(z.day)}T${pad(z.hour)}:${pad(z.minute)}`;
}

export function fromLocalInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return fromZoned(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
}

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o });
const F = {
  date: fmt({ weekday: "short", month: "short", day: "numeric" }),
  dateLong: fmt({ weekday: "long", month: "long", day: "numeric" }),
  dateYear: fmt({ month: "short", day: "numeric", year: "numeric" }),
  time: fmt({ hour: "numeric", minute: "2-digit" }),
  monthYear: fmt({ month: "long", year: "numeric" }),
};

/** "Tue, Oct 14" */
export const fmtDate = (d: Date) => F.date.format(d);
/** "Tuesday, October 14" */
export const fmtDateLong = (d: Date) => F.dateLong.format(d);
/** "Oct 14, 2026" */
export const fmtDateYear = (d: Date) => F.dateYear.format(d);
/** "6:00 PM", or "6 PM" on the hour (how the club writes it on graphics). */
export function fmtTime(d: Date, short = false): string {
  const s = F.time.format(d);
  return short ? s.replace(":00", "") : s;
}
/** "Tue, Oct 14 · 6:00 PM" */
export const fmtDateTime = (d: Date) => `${fmtDate(d)} · ${fmtTime(d)}`;
export const fmtMonthYear = (d: Date) => F.monthYear.format(d);

/** "in 3 days", "tomorrow", "today", "yesterday", "5 days ago" by Wichita calendar days. */
export function relativeDay(date: Date, now = new Date()): string {
  const a = parseDayKey(dayKey(now));
  const b = parseDayKey(dayKey(date));
  const diff = Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

/** "just now", "12 min ago", "3 hours ago", then the date. */
export function ago(date: Date, now = new Date()): string {
  const m = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  return fmtDate(date);
}

/** The instant `n` days before now (for "recent" cut-offs in queries). */
export function daysAgo(n: number, now = new Date()): Date {
  return new Date(now.getTime() - n * 86_400_000);
}
