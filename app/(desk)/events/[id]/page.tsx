import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Spark } from "@/components/Spark";
import { can } from "@/lib/auth/rules";
import { getUser } from "@/lib/auth/session";
import { presetByKey, type PlanStep } from "@/lib/brand/presets";
import { eventEnd, findGaps, missingSteps, planDates } from "@/lib/planning";
import { getEvent, postsForEvents, type PostLite } from "@/lib/planning/queries";
import { addDays, dayKey, fmtDateLong, fmtTime, parseDayKey, todayKey } from "@/lib/time";
import { addPlanStep, deleteEvent, setEventCancelled } from "../actions";
import { ActionButton, ConfirmAction } from "../_ui/ActionForm";
import { dayLabel, monthName, weekdayName } from "../_ui/DateBlock";
import { PostChip } from "../_ui/PostChip";
import ui from "../_ui/ui.module.css";
import { ResultsForm } from "./ResultsForm";
import s from "./event.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ev = await getEvent((await params).id);
  return { title: ev?.title ?? "Event" };
}

const ADD_LABEL: Record<string, string> = { announce: "announcement", linkedin: "LinkedIn post", reminder: "reminder", day_of: "day-of story", recap: "recap" };

interface Slot {
  kind: "post";
  post: PostLite;
}
interface Missing {
  kind: "missing";
  step: PlanStep;
  at: Date;
}

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; moved?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ev = await getEvent(id);
  if (!ev) notFound();
  const posts = await postsForEvents([ev.id]);
  const now = new Date();
  const cancelled = ev.status === "cancelled";
  const started = ev.startsAt.getTime() <= now.getTime();
  const over = eventEnd(ev).getTime() < now.getTime();
  const anyPosted = posts.some((p) => p.status === "posted");
  const gaps = findGaps([ev], posts, now, { horizonDays: 366 });
  const gapKinds = new Set<string>(gaps.map((g) => (g.type === "missing" ? g.kind : g.type === "no_recap" ? "recap" : "")));
  const overdue = new Set(gaps.flatMap((g) => (g.type === "overdue" ? [g.postId] : [])));
  const preset = presetByKey(ev.preset);

  // The run sheet: every day from the first planned post to the last, posts and missing steps on their dates.
  const plan = planDates(ev.startsAt);
  const missing: Missing[] = cancelled
    ? []
    : missingSteps(posts.map((p) => p.kind))
        .filter((st) => !over || st.kind === "recap")
        .map((step) => ({ kind: "missing", step, at: plan.find((p) => p.step.kind === step.kind)!.at }));
  const scheduled = posts.filter((p) => p.scheduledFor);
  const unscheduled = posts.filter((p) => !p.scheduledFor);
  const eventDay = dayKey(ev.startsAt);
  const endDay = dayKey(eventEnd(ev));
  const keys = [eventDay, ...plan.map((p) => p.day), ...scheduled.map((p) => dayKey(p.scheduledFor!))].sort();
  const first = keys[0]!;
  const last = keys.at(-1)!;
  const days: string[] = [];
  for (let k = first; k <= last && days.length < 120; k = addDays(k, 1)) days.push(k);
  const byDay = new Map<string, (Slot | Missing)[]>();
  for (const p of scheduled) {
    const k = dayKey(p.scheduledFor!);
    byDay.set(k, [...(byDay.get(k) ?? []), { kind: "post", post: p }]);
  }
  for (const m of missing) {
    const k = dayKey(m.at);
    byDay.set(k, [...(byDay.get(k) ?? []), m]);
  }
  for (const list of byDay.values()) list.sort((a, b) => (a.kind === "post" ? a.post.scheduledFor! : a.at).getTime() - (b.kind === "post" ? b.post.scheduledFor! : b.at).getTime());
  const today = todayKey();
  // Runs of 3 or more quiet days fold into one marker, so the whole plan fits on the stage.
  const quiet = (k: string) => !byDay.has(k) && !(k >= eventDay && k <= endDay) && k !== today;
  const segments: ({ day: string } | { from: string; to: string; n: number })[] = [];
  for (let i = 0; i < days.length; ) {
    let j = i;
    while (j < days.length && quiet(days[j]!)) j++;
    if (j - i >= 3) {
      segments.push({ from: days[i]!, to: days[j - 1]!, n: j - i });
      i = j;
    } else {
      segments.push({ day: days[i]! });
      i++;
    }
  }
  const mayEdit = can(user.role, "event.edit");
  const mayWrite = can(user.role, "post.edit");
  const where = ev.room ? `${ev.room.name}${ev.room.short && ev.room.short !== ev.room.name ? ` (${ev.room.short})` : ""}` : ev.place;

  return (
    <>
      <header className={`page-head ${s.head}`}>
        <div>
          <p className={s.series}>
            <Link href={"/events" as Route}>Events</Link> / {ev.seriesLabel || preset.name}
          </p>
          <h1 className={cancelled ? s.struck : undefined}>{ev.title}</h1>
          {cancelled ? <p className={s.cancelWord}>Cancelled</p> : ev.summary ? <p>{ev.summary}</p> : null}
        </div>
        <div className="btn-row">
          {mayWrite && !cancelled ? (
            <Link href={`/posts/new?event=${ev.id}` as Route} className="btn btn-s">
              Add another post
            </Link>
          ) : null}
          {mayEdit ? (
            <Link href={`/events/${ev.id}/edit` as Route} className="btn btn-s">
              Edit
            </Link>
          ) : null}
          {mayEdit && !cancelled ? (
            <ConfirmAction
              action={setEventCancelled}
              fields={{ eventId: ev.id, cancelled: "1" }}
              label="Cancel event"
              title={`Cancel ${ev.title}?`}
              body={
                <p>
                  It stays on the calendar, struck through, and its unpublished posts are flagged so nobody posts them. If it was already announced, write a short post saying so.
                </p>
              }
              confirmLabel="Cancel the event"
              danger
            />
          ) : null}
          {mayEdit && cancelled ? (
            <ActionButton action={setEventCancelled} fields={{ eventId: ev.id, cancelled: "0" }}>
              Restore event
            </ActionButton>
          ) : null}
          {can(user.role, "event.delete") && !anyPosted ? (
            <ConfirmAction
              action={deleteEvent}
              fields={{ eventId: ev.id }}
              label="Delete"
              title={`Delete ${ev.title}?`}
              body={
                <p>
                  This deletes the event and its {posts.length === 1 ? "post" : `${posts.length} posts`}, with their comments. It can&rsquo;t be undone. To keep a record, cancel it instead.
                </p>
              }
              confirmLabel="Delete for good"
              danger
            />
          ) : null}
        </div>
      </header>

      {sp.created !== undefined ? (
        <p className="notice" role="status">
          {Number(sp.created) > 0
            ? `Event added with ${sp.created} draft ${sp.created === "1" ? "post" : "posts"}, filled in from its facts. Open each to finish the words and ask for review.`
            : "Event added. It has no posts yet; add them from the run sheet."}
        </p>
      ) : null}
      {sp.moved ? (
        <p className="notice" role="status">
          Moved {sp.moved} {sp.moved === "1" ? "post" : "posts"} to the new dates. Their graphics still show the old date: open each and update it.
        </p>
      ) : null}
      {cancelled && posts.some((p) => p.status !== "posted") ? (
        <p className="notice notice-spark">
          <Spark /> This event is cancelled. Don&rsquo;t publish its posts; delete them, or reuse one to say it&rsquo;s off.
        </p>
      ) : null}

      <div className={s.layout}>
      <section className={s.stage} aria-labelledby="run-sheet">
        <h2 id="run-sheet" className={s.stageHead}>
          Run sheet
          <small>
            {posts.length} {posts.length === 1 ? "post" : "posts"}
            {missing.length ? `, ${missing.length} still to make` : ""}
          </small>
        </h2>
        <div className={s.sheetScroll} role="region" aria-label="Run sheet, scrolls sideways">
          <ol className={s.sheet}>
            {segments.map((seg) => {
              if (!("day" in seg)) {
                return (
                  <li key={seg.from} className={`${s.day} ${s.quiet}`}>
                    <span className={s.quietText}>
                      <span aria-hidden="true">{parseDayKey(seg.from).day}–{parseDayKey(seg.to).day}</span>
                      <span className="visually-hidden">
                        {dayLabel(seg.from)} to {dayLabel(seg.to)}: nothing planned
                      </span>
                    </span>
                  </li>
                );
              }
              const k = seg.day;
              const items = byDay.get(k) ?? [];
              const isEvent = k >= eventDay && k <= endDay;
              const { day } = parseDayKey(k);
              return (
                <li key={k} className={`${s.day} ${items.length ? s.full : s.emptyDay} ${isEvent ? s.eventDay : ""} ${k === today ? s.today : ""}`} aria-label={items.length || isEvent ? undefined : dayLabel(k)}>
                  <div className={s.dayHead}>
                    <span className={s.dayNum} aria-hidden="true">{day}</span>
                    {items.length || isEvent ? (
                      <span className={s.dayWords}>
                        <span aria-hidden="true">
                          {weekdayName(k)} {day === 1 || k === first ? monthName(k) : ""}
                        </span>
                        <span className="visually-hidden">{dayLabel(k)}</span>
                        {k === today ? <span className={s.todayWord}> today</span> : null}
                      </span>
                    ) : null}
                  </div>
                  {isEvent ? (
                    <p className={s.eventMark}>
                      <b>{k === eventDay ? "Event" : "Event, continued"}</b>
                      {k === eventDay ? <span className="figures">{fmtTime(ev.startsAt, true)}</span> : null}
                    </p>
                  ) : null}
                  {items.length ? (
                    <ul className={s.items}>
                      {items.map((it) =>
                        it.kind === "post" ? (
                          <li key={it.post.id}>
                            <PostChip
                              post={it.post}
                              size="xl"
                              flag={cancelled && it.post.status !== "posted" ? "Event cancelled" : overdue.has(it.post.id) ? "Overdue" : undefined}
                            />
                          </li>
                        ) : (
                          <li key={it.step.kind} className={s.missingItem}>
                            <span className={`${ui.hatch} ${s.slot} ${it.step.formats[0] === "story" ? s.slotStory : it.step.formats[0] === "wide" ? s.slotWide : ""}`} aria-hidden="true" />
                            <span className={s.missingText}>
                              <b>{it.step.label}</b>
                              <span className="figures muted">{fmtTime(it.at, true)}</span>
                              {gapKinds.has(it.step.kind) ? (
                                <span className={ui.flag}>
                                  <Spark /> Not made yet
                                </span>
                              ) : (
                                <span className="muted">Not made yet</span>
                              )}
                            </span>
                            {mayWrite ? (
                              <ActionButton action={addPlanStep} fields={{ eventId: ev.id, kind: it.step.kind }} pendingLabel="Making…">
                                Add {ADD_LABEL[it.step.kind]}
                              </ActionButton>
                            ) : null}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
        {unscheduled.length ? (
          <div className={s.unscheduled}>
            <h3>Not scheduled</h3>
            <ul className={s.items}>
              {unscheduled.map((p) => (
                <li key={p.id}>
                  <PostChip post={p} size="xl" flag={cancelled && p.status !== "posted" ? "Event cancelled" : undefined} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
        <aside className={s.side}>
        <section className={`panel ${s.factsPanel}`} aria-labelledby="facts">
          <h2 id="facts">Facts</h2>
          <dl className={s.facts}>
        <div>
          <dt>When</dt>
          <dd>
            {fmtDateLong(ev.startsAt)}
            <br />
            <span className="figures">
              {fmtTime(ev.startsAt)}
              {ev.endsAt ? ` to ${endDay !== eventDay ? `${fmtDateLong(ev.endsAt)}, ` : ""}${fmtTime(ev.endsAt)}` : ""}
            </span>
          </dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>{where || <span className="muted">Not set</span>}</dd>
        </div>
        <div>
          <dt>Speakers</dt>
          <dd>{ev.speakers.length ? ev.speakers.join(", ") : <span className="muted">None</span>}</dd>
        </div>
        <div>
          <dt>Partners</dt>
          <dd>{ev.partners.length ? ev.partners.join(", ") : <span className="muted">None</span>}</dd>
        </div>
        <div>
          <dt>RSVP</dt>
          <dd className={s.link}>
            {ev.rsvpUrl ? (
              <a href={ev.rsvpUrl} rel="noopener noreferrer" target="_blank">
                {ev.rsvpUrl.replace(/^https:\/\//, "")}
              </a>
            ) : (
              <span className="muted">No link</span>
            )}
          </dd>
        </div>
      </dl>
        </section>
      {started && !cancelled ? (
        <section className={`panel ${s.resultsPanel}`} aria-labelledby="results">
          <h2 id="results">
            Results
            <small>They fill in the recap graphic&rsquo;s numbers.</small>
          </h2>
          {can(user.role, "results.edit") ? (
            <ResultsForm eventId={ev.id} rsvps={ev.rsvps} attendance={ev.attendance} note={ev.resultsNote} />
          ) : (
            <dl className={s.facts}>
              <div>
                <dt>RSVPs</dt>
                <dd className="figures">{ev.rsvps ?? "Not logged"}</dd>
              </div>
              <div>
                <dt>Came</dt>
                <dd className="figures">{ev.attendance ?? "Not logged"}</dd>
              </div>
              <div>
                <dt>Note</dt>
                <dd>{ev.resultsNote || <span className="muted">None</span>}</dd>
              </div>
            </dl>
          )}
        </section>
      ) : null}
        </aside>
      </div>
    </>
  );
}
