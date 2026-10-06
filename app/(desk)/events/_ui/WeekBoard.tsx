import type { Route } from "next";
import Link from "next/link";
import { Spark } from "@/components/Spark";
import { bucketByDay, isWeekend, type MissingSlot } from "@/lib/planning";
import type { BoardData, EventLite, PostLite } from "@/lib/planning/queries";
import { addDays, dayKey, fmtTime, parseDayKey } from "@/lib/time";
import { addPlanStep } from "../actions";
import { ActionButton } from "./ActionForm";
import { dayLabel, monthName, weekdayName } from "./DateBlock";
import { PostChip, THUMB } from "./PostChip";
import { stepLabel } from "./labels";
import ui from "./ui.module.css";
import b from "./board.module.css";

/**
 * The week board: one column per day, events as strong labels, that day's posts as readable
 * covers, and plan steps that should exist but don't as hatched slots with a one-click add.
 * Used by the home page and the calendar's week view.
 */
export function WeekBoard({ fromKey, days = 7, data, today, now, mayWrite, label }: { fromKey: string; days?: number; data: BoardData; today: string; now: Date; mayWrite: boolean; label: string }) {
  const keys = Array.from({ length: days }, (_, i) => addDays(fromKey, i));
  const postsByDay = new Map(bucketByDay(data.posts, fromKey, days, (p) => p.scheduledFor).map((x) => [x.key, x.items]));
  const slotsByDay = new Map<string, MissingSlot[]>();
  for (const s of data.slots) slotsByDay.set(s.day, [...(slotsByDay.get(s.day) ?? []), s]);
  const eventsByDay = new Map<string, EventLite[]>();
  for (const ev of data.events) {
    const end = dayKey(ev.endsAt ?? ev.startsAt);
    for (let k = dayKey(ev.startsAt); k <= end; k = addDays(k, 1)) eventsByDay.set(k, [...(eventsByDay.get(k) ?? []), ev]);
  }
  const cancelled = new Set(data.events.filter((e) => e.status === "cancelled").map((e) => e.id));

  return (
    <ol className={b.board} aria-label={label}>
      {keys.map((k) => {
        const evs = eventsByDay.get(k) ?? [];
        const posts = postsByDay.get(k) ?? [];
        const slots = slotsByDay.get(k) ?? [];
        // Posts and missing slots interleave by time.
        const items: ({ t: number; post: PostLite } | { t: number; slot: MissingSlot })[] = [
          ...posts.map((post) => ({ t: post.scheduledFor!.getTime(), post })),
          ...slots.map((slot) => ({ t: slot.at.getTime(), slot })),
        ].sort((x, y) => x.t - y.t);
        const empty = !evs.length && !items.length;
        const isToday = k === today;
        const past = k < today;
        return (
          <li key={k} className={[b.col, isToday && b.today, isWeekend(k) && b.weekend, past && b.past, empty && b.free].filter(Boolean).join(" ")} aria-current={isToday ? "date" : undefined}>
            <h3 className={b.head}>
              <span className={b.wd} aria-hidden="true">
                {weekdayName(k)}
                {isToday ? <span className={b.todayWord}>Today</span> : null}
              </span>
              <span className={b.num} aria-hidden="true">
                {parseDayKey(k).day}
                {parseDayKey(k).day === 1 || k === fromKey ? <span className={b.month}> {monthName(k)}</span> : null}
              </span>
              <span className="visually-hidden">
                {dayLabel(k)}
                {isToday ? ", today" : ""}
              </span>
            </h3>
            {evs.map((ev) => (
              <div key={ev.id} className={`${b.event} ${ev.status === "cancelled" ? b.cancelled : ""}`}>
                <span className={`figures ${b.evTime}`}>{dayKey(ev.startsAt) === k ? fmtTime(ev.startsAt, true) : "Continues"}</span>
                <Link href={`/events/${ev.id}` as Route} className={b.evTitle}>
                  {ev.title}
                </Link>
                <span className={b.evMeta}>{ev.status === "cancelled" ? <span className={b.cancelWord}>Cancelled</span> : [ev.seriesLabel, ev.room?.short || ev.place].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
            {items.length ? (
              <ul className={b.stack}>
                {items.map((it) =>
                  "post" in it ? (
                    <li key={it.post.id}>
                      <PostChip
                        post={it.post}
                        size="l"
                        showEvent={!!it.post.eventTitle && !evs.some((e) => e.id === it.post.eventId)}
                        flag={postFlag(it.post, now, cancelled)}
                      />
                    </li>
                  ) : (
                    <li key={`${it.slot.eventId}-${it.slot.step.kind}`} className={b.slot}>
                      <span className={`${ui.hatch} ${b.slotBox}`} style={{ inlineSize: THUMB.l[it.slot.step.formats[0] ?? "feed"], aspectRatio: it.slot.step.formats[0] === "story" ? "9 / 16" : it.slot.step.formats[0] === "wide" ? "1200 / 627" : "4 / 5" }} aria-hidden="true" />
                      <span className={b.slotText}>
                        <b>{it.slot.step.label.split(",")[0]}</b>
                        <span className={b.slotFor}>{it.slot.eventTitle}</span>
                        <span className="figures muted">{fmtTime(it.slot.at, true)}</span>
                        {it.slot.urgent ? (
                          <span className={ui.flag}>
                            <Spark /> Not made yet
                          </span>
                        ) : (
                          <span className="muted">Not made yet</span>
                        )}
                      </span>
                      {mayWrite ? (
                        <ActionButton action={addPlanStep} fields={{ eventId: it.slot.eventId, kind: it.slot.step.kind }} pendingLabel="Making…" className="btn btn-s">
                          Add {stepLabel(it.slot.step.kind)}
                          <span className="visually-hidden"> for {it.slot.eventTitle}</span>
                        </ActionButton>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
            ) : null}
            {empty ? <p className={b.freeWord}>Nothing planned</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

function postFlag(p: PostLite, now: Date, cancelled: Set<string>): string | undefined {
  if (p.eventId && cancelled.has(p.eventId) && p.status !== "posted") return "Event cancelled";
  if (!p.scheduledFor || p.scheduledFor.getTime() >= now.getTime() || p.status === "posted") return undefined;
  return p.status === "approved" ? "Ready, not posted" : "Overdue";
}
