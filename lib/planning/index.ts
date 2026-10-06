import { EVENT_PLAN, KIND_LABEL, presetByKey, type PlanStep } from "@/lib/brand/presets";
import { addDays, dayKey, fromZoned, parseDayKey, startOfWeek, weekdayOfKey } from "@/lib/time";

/**
 * Planning logic: when an event's posts go out, what is missing, and how dated things fall
 * into Wichita days. Pure (no database, no "server-only"), so pages, client forms, the seed
 * script and unit tests all share it.
 */

export type PostKind = "announce" | "linkedin" | "reminder" | "day_of" | "recap" | "photos" | "custom";
export type PostStatus = "draft" | "in_review" | "changes_requested" | "approved" | "posted";
export type StepKind = PlanStep["kind"];

const DAY_MS = 86_400_000;

/* ---------------- plan dates ---------------- */

export interface PlannedDate {
  step: PlanStep;
  /** The UTC instant: the event's Wichita start day plus dayOffset, at step.hour Wichita time. */
  at: Date;
  /** Wichita day key of `at`. */
  day: string;
}

/** The scheduled instant for each plan step of an event starting at `eventStart`. */
export function planDates(eventStart: Date, steps: readonly PlanStep[] = EVENT_PLAN): PlannedDate[] {
  const startDay = dayKey(eventStart);
  return steps.map((step) => {
    const day = addDays(startDay, step.dayOffset);
    const { year, month, day: d } = parseDayKey(day);
    return { step, at: fromZoned(year, month, d, step.hour, 0), day };
  });
}

export function stepByKind(kind: string): PlanStep | undefined {
  return EVENT_PLAN.find((s) => s.kind === kind);
}

/**
 * Which plan steps to offer on create, and whether each starts ticked: a step whose time has
 * passed starts unticked; an event already over gets only the recap.
 */
export function planChoices(eventStart: Date, now: Date, eventEnd: Date | null = null, steps: readonly PlanStep[] = EVENT_PLAN) {
  const over = (eventEnd ?? eventStart).getTime() < now.getTime();
  return planDates(eventStart, steps)
    .filter((p) => !over || p.step.kind === "recap")
    .map((p) => ({ ...p, past: p.at.getTime() < now.getTime(), checked: p.at.getTime() >= now.getTime() || (over && p.step.kind === "recap") }));
}

/* ---------------- gaps ---------------- */

export interface GapEvent {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  status: "planned" | "cancelled";
}

export interface GapPost {
  id: string;
  eventId: string | null;
  kind: PostKind;
  status: PostStatus;
  scheduledFor: Date | null;
}

export type Gap =
  | { type: "missing"; kind: "announce" | "reminder"; eventId: string; eventTitle: string; eventStart: Date; due: Date }
  | { type: "no_recap"; eventId: string; eventTitle: string; endedAt: Date }
  | { type: "overdue"; postId: string; eventId: string | null; kind: PostKind; status: PostStatus; scheduledFor: Date };

export interface GapOptions {
  /** Upcoming events this many days ahead are checked for missing announce and reminder posts. */
  horizonDays?: number;
  /** Events that ended longer ago than this are no longer nagged about a recap. */
  recapWindowDays?: number;
}

const ANNOUNCE_AND_REMINDER = ["announce", "reminder"] as const;

/** When the event is over: its end, or its start when no end is set. */
export const eventEnd = (e: { startsAt: Date; endsAt: Date | null }) => e.endsAt ?? e.startsAt;

/**
 * What needs planning attention, as of `now`:
 *  - missing: a planned event starting within the horizon has no announce or reminder post;
 *  - no_recap: a planned event ended on an earlier Wichita day (1+ day ago) and has no recap post;
 *  - overdue: a post's scheduled time has passed and it is not approved or posted.
 * Cancelled events, and posts belonging to them, are left out: they are flagged on the event.
 */
export function findGaps(events: readonly GapEvent[], posts: readonly GapPost[], now: Date, opts: GapOptions = {}): Gap[] {
  const horizon = now.getTime() + (opts.horizonDays ?? 21) * DAY_MS;
  const recapFrom = dayKey(new Date(now.getTime() - (opts.recapWindowDays ?? 30) * DAY_MS));
  const today = dayKey(now);
  const kindsByEvent = new Map<string, Set<string>>();
  for (const p of posts) {
    if (!p.eventId) continue;
    let s = kindsByEvent.get(p.eventId);
    if (!s) kindsByEvent.set(p.eventId, (s = new Set()));
    s.add(p.kind);
  }
  const cancelled = new Set(events.filter((e) => e.status === "cancelled").map((e) => e.id));
  const out: Gap[] = [];

  for (const e of events) {
    if (e.status !== "planned") continue;
    const kinds = kindsByEvent.get(e.id) ?? new Set<string>();
    const start = e.startsAt.getTime();
    if (start > now.getTime() && start <= horizon) {
      const dates = planDates(e.startsAt);
      for (const kind of ANNOUNCE_AND_REMINDER) {
        if (kinds.has(kind)) continue;
        const due = dates.find((d) => d.step.kind === kind)!.at;
        out.push({ type: "missing", kind, eventId: e.id, eventTitle: e.title, eventStart: e.startsAt, due });
      }
    }
    const endDay = dayKey(eventEnd(e));
    if (endDay < today && endDay >= recapFrom && !kinds.has("recap")) {
      out.push({ type: "no_recap", eventId: e.id, eventTitle: e.title, endedAt: eventEnd(e) });
    }
  }

  for (const p of posts) {
    if (!p.scheduledFor || p.scheduledFor.getTime() >= now.getTime()) continue;
    if (p.status === "approved" || p.status === "posted") continue;
    if (p.eventId && cancelled.has(p.eventId)) continue;
    out.push({ type: "overdue", postId: p.id, eventId: p.eventId, kind: p.kind, status: p.status, scheduledFor: p.scheduledFor });
  }

  const when = (g: Gap) => (g.type === "missing" ? g.due : g.type === "no_recap" ? g.endedAt : g.scheduledFor).getTime();
  return out.sort((a, b) => when(a) - when(b));
}

/** "No reminder yet", "No recap yet", "Overdue reminder": how a gap reads next to its event. */
export function gapLabel(g: Gap): string {
  if (g.type === "missing") return g.kind === "announce" ? "No announcement yet" : "No reminder yet";
  if (g.type === "no_recap") return "No recap yet";
  return `${KIND_LABEL[g.kind] ?? "Post"} is overdue`;
}

/** Plan steps an event has no post for yet (by kind). */
export function missingSteps(existingKinds: Iterable<string>, steps: readonly PlanStep[] = EVENT_PLAN): PlanStep[] {
  const have = new Set(existingKinds);
  return steps.filter((s) => !have.has(s.kind));
}

/* ---------------- day buckets ---------------- */

export interface DayBucket<T> {
  key: string;
  items: T[];
}

/**
 * Puts dated items into consecutive Wichita days starting at `fromKey`. Items outside the range
 * (or without a date) are dropped. Each day's items keep time order.
 */
export function bucketByDay<T>(items: readonly T[], fromKey: string, days: number, at: (item: T) => Date | null = (i) => (i as { at: Date | null }).at): DayBucket<T>[] {
  const buckets: DayBucket<T>[] = Array.from({ length: Math.max(0, days) }, (_, i) => ({ key: addDays(fromKey, i), items: [] }));
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  const sorted = items.map((it) => ({ it, d: at(it) })).filter((x): x is { it: T; d: Date } => x.d !== null).sort((a, b) => a.d.getTime() - b.d.getTime());
  for (const { it, d } of sorted) {
    const i = index.get(dayKey(d));
    if (i !== undefined) buckets[i]!.items.push(it);
  }
  return buckets;
}

/* ---------------- months and weeks ---------------- */

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** "2026-10" from a ?month= value, or the month of `todayKey` when missing or malformed. */
export function parseMonth(value: string | undefined | null, todayKey: string): string {
  const m = value ? MONTH_RE.exec(value) : null;
  if (m && Number(m[1]) >= 2000 && Number(m[1]) <= 2100) return value!;
  return todayKey.slice(0, 7);
}

/** A valid day key from a ?week= value, or null. Rejects impossible dates like 2026-02-31. */
export function parseDay(value: string | undefined | null): string | null {
  if (!value || !DAY_RE.test(value)) return null;
  const { year } = parseDayKey(value);
  if (year < 2000 || year > 2100) return null;
  return addDays(value, 0) === value ? value : null;
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** The weeks (Monday to Sunday, as day keys) that cover a month. 4 to 6 rows. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const next = `${shiftMonth(month, 1)}-01`;
  const weeks: string[][] = [];
  for (let wk = startOfWeek(first); wk < next; wk = addDays(wk, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(wk, i)));
  }
  return weeks;
}

/** The first and last instants a set of day keys covers, for a database range query. */
export function dayRange(fromKey: string, days: number): { from: Date; to: Date } {
  const a = parseDayKey(fromKey);
  const b = parseDayKey(addDays(fromKey, days));
  return { from: fromZoned(a.year, a.month, a.day), to: fromZoned(b.year, b.month, b.day) };
}

export const isWeekend = (key: string) => {
  const wd = weekdayOfKey(key);
  return wd === 0 || wd === 6;
};

/* ---------------- series labels ---------------- */

/**
 * The next label in a numbered series: "Workshop · 01" with 2 workshops before it gives
 * "Workshop · 03". Series without a number ("Partner event") stay as they are.
 */
export function nextSeriesLabel(presetKey: string, priorCount: number): string {
  const base = presetByKey(presetKey).fields.series ?? "";
  const m = /^(.*?)(\d+)\s*$/.exec(base);
  if (!m) return base;
  const width = m[2]!.length;
  return `${m[1]}${String(priorCount + 1).padStart(width, "0")}`;
}

/* ---------------- board slots ---------------- */

export interface MissingSlot {
  eventId: string;
  eventTitle: string;
  step: PlanStep;
  /** When the post should go out. */
  at: Date;
  day: string;
  /** Its time has passed, or comes within two days: worth the gold spark. */
  urgent: boolean;
}

/**
 * Plan steps that have no post yet, placed on the Wichita day they should go out, for days in
 * [fromKey, fromKey + days). Planned events only; once an event is over, only its recap counts.
 */
export function missingSlots(events: readonly GapEvent[], posts: readonly GapPost[], fromKey: string, days: number, now: Date, steps: readonly PlanStep[] = EVENT_PLAN): MissingSlot[] {
  const toKey = addDays(fromKey, days);
  const out: MissingSlot[] = [];
  for (const e of events) {
    if (e.status !== "planned") continue;
    const kinds = posts.filter((p) => p.eventId === e.id).map((p) => p.kind);
    const over = eventEnd(e).getTime() < now.getTime();
    for (const step of missingSteps(kinds, steps)) {
      if (over && step.kind !== "recap") continue;
      const [p] = planDates(e.startsAt, [step]);
      if (!p || p.day < fromKey || p.day >= toKey) continue;
      out.push({ eventId: e.id, eventTitle: e.title, step, at: p.at, day: p.day, urgent: p.at.getTime() < now.getTime() + 2 * DAY_MS });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** True when a post's time is close or past and it still needs someone: for the gold spark. */
export function isUrgent(scheduledFor: Date | null, now: Date, withinHours = 24): boolean {
  return !!scheduledFor && scheduledFor.getTime() < now.getTime() + withinHours * 3_600_000;
}
