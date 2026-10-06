import { describe, expect, it } from "vitest";
import { EVENT_PLAN } from "@/lib/brand/presets";
import {
  bucketByDay,
  dayRange,
  findGaps,
  gapLabel,
  missingSlots,
  missingSteps,
  monthGrid,
  nextSeriesLabel,
  parseDay,
  parseMonth,
  planChoices,
  planDates,
  shiftMonth,
  type GapEvent,
  type GapPost,
} from "@/lib/planning";
import { fromZoned } from "@/lib/time";

const iso = (d: Date) => d.toISOString();
const byKind = (start: Date) => Object.fromEntries(planDates(start).map((p) => [p.step.kind, p]));

describe("planDates", () => {
  it("schedules each step on the event's Wichita day plus its offset, at the step's Wichita hour", () => {
    const p = byKind(fromZoned(2026, 10, 14, 18, 0)); // Wed Oct 14, 6 PM CDT
    expect(iso(p.announce!.at)).toBe("2026-10-02T17:00:00.000Z"); // Oct 2, 12 PM CDT
    expect(iso(p.linkedin!.at)).toBe("2026-10-04T14:00:00.000Z"); // Oct 4, 9 AM CDT
    expect(iso(p.reminder!.at)).toBe("2026-10-13T22:00:00.000Z"); // Oct 13, 5 PM CDT
    expect(iso(p.day_of!.at)).toBe("2026-10-14T14:00:00.000Z");
    expect(iso(p.recap!.at)).toBe("2026-10-16T17:00:00.000Z");
    expect(p.recap!.day).toBe("2026-10-16");
  });

  it("keeps wall-clock hours across the end of daylight saving (Nov 1, 2026)", () => {
    const p = byKind(fromZoned(2026, 11, 2, 18, 0)); // Mon Nov 2, CST
    expect(iso(p.announce!.at)).toBe("2026-10-21T17:00:00.000Z"); // still CDT, UTC-5
    expect(iso(p.reminder!.at)).toBe("2026-11-01T23:00:00.000Z"); // the changeover day, CST, UTC-6
    expect(iso(p.day_of!.at)).toBe("2026-11-02T15:00:00.000Z");
  });

  it("keeps wall-clock hours across the start of daylight saving (Mar 14, 2027)", () => {
    const p = byKind(fromZoned(2027, 3, 15, 18, 0));
    expect(iso(p.announce!.at)).toBe("2027-03-03T18:00:00.000Z"); // CST, UTC-6
    expect(iso(p.reminder!.at)).toBe("2027-03-14T22:00:00.000Z"); // CDT from 2 AM that day
    expect(iso(p.day_of!.at)).toBe("2027-03-15T14:00:00.000Z");
  });

  it("uses the Wichita day, not the UTC day, of a late-evening event", () => {
    const start = fromZoned(2026, 10, 14, 23, 30); // 04:30 UTC on Oct 15
    expect(byKind(start).day_of!.day).toBe("2026-10-14");
    expect(iso(byKind(start).reminder!.at)).toBe("2026-10-13T22:00:00.000Z");
  });

  it("crosses month and year ends", () => {
    const p = byKind(fromZoned(2027, 1, 5, 18, 0));
    expect(p.announce!.day).toBe("2026-12-24");
  });
});

describe("planChoices", () => {
  const start = fromZoned(2026, 10, 14, 18, 0);
  it("ticks every step for an event far enough ahead", () => {
    const c = planChoices(start, fromZoned(2026, 9, 1, 9, 0));
    expect(c.map((x) => x.checked)).toEqual(EVENT_PLAN.map(() => true));
  });
  it("unticks steps whose time has passed", () => {
    const c = planChoices(start, fromZoned(2026, 10, 5, 9, 0));
    const ticked = Object.fromEntries(c.map((x) => [x.step.kind, x.checked]));
    expect(ticked).toEqual({ announce: false, linkedin: false, reminder: true, day_of: true, recap: true });
    expect(c.find((x) => x.step.kind === "announce")!.past).toBe(true);
  });
  it("offers only the recap for an event that is already over", () => {
    const c = planChoices(start, fromZoned(2026, 10, 20, 9, 0));
    expect(c.map((x) => x.step.kind)).toEqual(["recap"]);
    expect(c[0]!.checked).toBe(true);
  });
});

describe("findGaps", () => {
  const now = fromZoned(2026, 10, 5, 10, 0);
  const ev = (id: string, start: Date, extra: Partial<GapEvent> = {}): GapEvent => ({ id, title: id, startsAt: start, endsAt: null, status: "planned", ...extra });
  const post = (id: string, eventId: string | null, kind: GapPost["kind"], status: GapPost["status"] = "draft", scheduledFor: Date | null = null): GapPost => ({ id, eventId, kind, status, scheduledFor });

  it("flags missing announce and reminder for events inside the horizon only", () => {
    const soon = ev("soon", fromZoned(2026, 10, 14, 18, 0));
    const far = ev("far", fromZoned(2026, 11, 30, 18, 0));
    const gaps = findGaps([soon, far], [post("a", "soon", "announce")], now);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ type: "missing", kind: "reminder", eventId: "soon" });
    expect(gapLabel(gaps[0]!)).toBe("No reminder yet");
    expect(findGaps([far], [], now, { horizonDays: 90 })).toHaveLength(2);
  });

  it("does not flag an event that has started or is cancelled", () => {
    const started = ev("started", fromZoned(2026, 10, 5, 9, 0));
    const cancelled = ev("x", fromZoned(2026, 10, 14, 18, 0), { status: "cancelled" });
    expect(findGaps([started, cancelled], [], now)).toEqual([]);
  });

  it("asks for a recap from the Wichita day after the event ends", () => {
    const lastNight = ev("last", fromZoned(2026, 10, 4, 22, 30));
    expect(findGaps([lastNight], [], now).map((g) => g.type)).toEqual(["no_recap"]);
    const thisMorning = ev("today", fromZoned(2026, 10, 5, 8, 0));
    expect(findGaps([thisMorning], [], now)).toEqual([]);
    // Multi-day: ends today, so no recap yet.
    const multi = ev("multi", fromZoned(2026, 10, 3, 9, 0), { endsAt: fromZoned(2026, 10, 5, 17, 0) });
    expect(findGaps([multi], [], now)).toEqual([]);
    // A recap post, in any state, closes the gap.
    expect(findGaps([lastNight], [post("r", "last", "recap")], now)).toEqual([]);
  });

  it("stops nagging about recaps after the window", () => {
    const old = ev("old", fromZoned(2026, 8, 1, 18, 0));
    expect(findGaps([old], [], now)).toEqual([]);
  });

  it("flags scheduled posts in the past that are not approved or posted", () => {
    const e = ev("e", fromZoned(2026, 10, 14, 18, 0));
    const past = fromZoned(2026, 10, 2, 12, 0);
    const posts = [
      post("p1", "e", "announce", "in_review", past),
      post("p2", "e", "linkedin", "approved", past),
      post("p3", null, "custom", "posted", past),
      post("p4", "e", "reminder", "draft", fromZoned(2026, 10, 13, 17, 0)),
    ];
    const gaps = findGaps([e], posts, now);
    expect(gaps).toEqual([{ type: "overdue", postId: "p1", eventId: "e", kind: "announce", status: "in_review", scheduledFor: past }]);
  });

  it("ignores overdue posts of cancelled events", () => {
    const e = ev("e", fromZoned(2026, 10, 14, 18, 0), { status: "cancelled" });
    expect(findGaps([e], [post("p", "e", "announce", "draft", fromZoned(2026, 10, 2, 12))], now)).toEqual([]);
  });

  it("lists missing steps by kind", () => {
    expect(missingSteps(["announce", "recap", "custom"]).map((s) => s.kind)).toEqual(["linkedin", "reminder", "day_of"]);
  });
});

describe("bucketByDay", () => {
  it("buckets by Wichita day, in time order, dropping what falls outside", () => {
    const items = [
      { id: "late", at: new Date("2026-10-06T03:30:00Z") }, // Oct 5, 10:30 PM CDT
      { id: "early", at: fromZoned(2026, 10, 5, 8, 0) },
      { id: "next", at: fromZoned(2026, 10, 6, 0, 0) },
      { id: "before", at: fromZoned(2026, 10, 4, 23, 59) },
      { id: "none", at: null },
    ];
    const b = bucketByDay(items, "2026-10-05", 3);
    expect(b.map((x) => x.key)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
    expect(b[0]!.items.map((i) => i.id)).toEqual(["early", "late"]);
    expect(b[1]!.items.map((i) => i.id)).toEqual(["next"]);
    expect(b[2]!.items).toEqual([]);
  });

  it("spans the daylight saving change without skipping or doubling a day", () => {
    const b = bucketByDay([{ at: fromZoned(2026, 11, 1, 23, 30) }, { at: fromZoned(2026, 11, 2, 0, 30) }], "2026-10-31", 3);
    expect(b.map((x) => x.items.length)).toEqual([0, 1, 1]);
  });

  it("takes a custom date accessor", () => {
    const b = bucketByDay([{ when: fromZoned(2026, 10, 5, 12) }], "2026-10-05", 1, (x) => x.when);
    expect(b[0]!.items).toHaveLength(1);
  });
});

describe("months and weeks", () => {
  it("builds Monday-first grids that cover the month", () => {
    const g = monthGrid("2026-10"); // Oct 1, 2026 is a Thursday
    expect(g[0]![0]).toBe("2026-09-28");
    expect(g.at(-1)!.at(-1)).toBe("2026-11-01");
    expect(g).toHaveLength(5);
    expect(monthGrid("2026-02")).toHaveLength(4 + 1); // Feb 1, 2026 is a Sunday
  });
  it("parses and shifts months and days defensively", () => {
    expect(parseMonth("2026-13", "2026-10-05")).toBe("2026-10");
    expect(parseMonth("2027-01", "2026-10-05")).toBe("2027-01");
    expect(parseMonth(undefined, "2026-10-05")).toBe("2026-10");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(parseDay("2026-02-31")).toBeNull();
    expect(parseDay("2026-10-05")).toBe("2026-10-05");
    expect(parseDay("x")).toBeNull();
  });
  it("gives the UTC range of Wichita days, including a 25-hour day", () => {
    const r = dayRange("2026-11-01", 1);
    expect(r.to.getTime() - r.from.getTime()).toBe(25 * 3_600_000);
  });
});

describe("nextSeriesLabel", () => {
  it("numbers from the count of earlier events in the series", () => {
    expect(nextSeriesLabel("workshop", 2)).toBe("Workshop · 03");
    expect(nextSeriesLabel("speaker-series", 0)).toBe("Speaker series · 01");
    expect(nextSeriesLabel("partner", 4)).toBe("Partner event");
  });
});

describe("missingSlots", () => {
  const now = fromZoned(2026, 10, 5, 10, 0);
  const ev = { id: "e", title: "E", startsAt: fromZoned(2026, 10, 8, 18, 0), endsAt: null, status: "planned" as const };
  it("places missing steps on their day within the range", () => {
    const slots = missingSlots([ev], [{ id: "a", eventId: "e", kind: "announce", status: "posted", scheduledFor: null }], "2026-10-05", 7, now);
    expect(slots.map((s) => [s.step.kind, s.day, s.urgent])).toEqual([
      ["reminder", "2026-10-07", false],
      ["day_of", "2026-10-08", false],
      ["recap", "2026-10-10", false],
    ]);
    const nextDay = missingSlots([ev], [], "2026-10-05", 7, fromZoned(2026, 10, 6, 9, 0));
    expect(nextDay.find((s) => s.step.kind === "reminder")!.urgent).toBe(true);
  });
  it("offers only the recap once the event is over, and nothing for cancelled events", () => {
    const later = fromZoned(2026, 10, 9, 10, 0);
    expect(missingSlots([ev], [], "2026-10-05", 7, later).map((s) => s.step.kind)).toEqual(["recap"]);
    expect(missingSlots([{ ...ev, status: "cancelled" }], [], "2026-10-05", 7, now)).toEqual([]);
  });
});
