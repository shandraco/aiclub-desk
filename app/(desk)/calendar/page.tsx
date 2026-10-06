import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PostThumb } from "@/components/post/PostThumb";
import { Spark } from "@/components/Spark";
import { STATUS_LABEL } from "@/components/StatusWord";
import { can } from "@/lib/auth/rules";
import { getUser } from "@/lib/auth/session";
import { bucketByDay, dayRange, findGaps, gapLabel, isWeekend, monthGrid, parseDay, parseMonth, shiftMonth, type Gap } from "@/lib/planning";
import { boardData, eventsInRange, postsForEvents, postsInRange, type EventLite, type PostLite } from "@/lib/planning/queries";
import { addDays, dayKey, fmtTime, parseDayKey, startOfWeek, todayKey } from "@/lib/time";
import { dayLabel, monthName, weekdayName } from "../events/_ui/DateBlock";
import { KIND_LABEL } from "../events/_ui/labels";
import { WeekBoard } from "../events/_ui/WeekBoard";
import s from "./calendar.module.css";

export const metadata: Metadata = { title: "Calendar" };

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MAX_MARKS = 4;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; view?: string; week?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const today = todayKey();
  const now = new Date();

  if (sp.view === "week") {
    const wk = startOfWeek(parseDay(sp.week) ?? today);
    const end = addDays(wk, 6);
    const title = `${monthName(wk, true)} ${parseDayKey(wk).day} to ${monthName(end) !== monthName(wk) ? `${monthName(end, true)} ` : ""}${parseDayKey(end).day}`;
    const data = await boardData(wk, 7, now);
    return (
      <>
        <Head
          title={title}
          sub={String(parseDayKey(end).year)}
          prev={`/calendar?view=week&week=${addDays(wk, -7)}`}
          next={`/calendar?view=week&week=${addDays(wk, 7)}`}
          today="/calendar?view=week"
          unit="week"
          monthHref={`/calendar?month=${wk.slice(0, 7)}`}
          weekHref={`/calendar?view=week&week=${wk}`}
          view="week"
        />
        <WeekBoard fromKey={wk} data={data} today={today} now={now} mayWrite={can(user.role, "post.edit")} label={`Days of the week, ${title}`} />
      </>
    );
  }

  const month = parseMonth(sp.month, today);
  const days = monthGrid(month).flat();
  const title = `${monthName(`${month}-01`, true)}`;
  const { from, to } = dayRange(days[0]!, days.length);
  const [events, posts] = await Promise.all([eventsInRange(from, to), postsInRange(from, to)]);
  const eventPosts = await postsForEvents(events.map((e) => e.id));
  const gaps = findGaps(events, eventPosts, now, { horizonDays: 366 }).filter((g) => g.type !== "overdue");
  const buckets = new Map(bucketByDay(posts, days[0]!, days.length, (p) => p.scheduledFor).map((b) => [b.key, b.items]));
  const evByDay = new Map<string, EventLite[]>();
  for (const ev of events) {
    const end = dayKey(ev.endsAt ?? ev.startsAt);
    for (let k = dayKey(ev.startsAt); k <= end; k = addDays(k, 1)) evByDay.set(k, [...(evByDay.get(k) ?? []), ev]);
  }
  const gapsOf = (id: string) => gaps.filter((g) => g.eventId === id);
  const late = (p: PostLite) => !!p.scheduledFor && p.scheduledFor.getTime() < now.getTime() && p.status !== "approved" && p.status !== "posted";
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const thisWeekInMonth = month === today.slice(0, 7) ? startOfWeek(today) : startOfWeek(`${month}-01`);
  const busy = days.filter((k) => k.slice(0, 7) === month && ((evByDay.get(k) ?? []).length || (buckets.get(k) ?? []).length));

  return (
    <>
      <Head
        title={title}
        sub={month.slice(0, 4)}
        prev={`/calendar?month=${shiftMonth(month, -1)}`}
        next={`/calendar?month=${shiftMonth(month, 1)}`}
        today="/calendar"
        unit="month"
        monthHref={`/calendar?month=${month}`}
        weekHref={`/calendar?view=week&week=${thisWeekInMonth}`}
        view="month"
      />
      <div className={s.sheet}>
        <table className={s.grid}>
          <caption className="visually-hidden">
            {title} {month.slice(0, 4)}: events and scheduled posts by day, Monday to Sunday
          </caption>
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col">
                  <abbr title={d}>{d.slice(0, 3)}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((wk) => (
              <tr key={wk[0]}>
                {wk.map((k) => {
                  const evs = evByDay.get(k) ?? [];
                  const ps = buckets.get(k) ?? [];
                  const outside = k.slice(0, 7) !== month;
                  return (
                    <td key={k} className={[s.cell, outside && s.outside, isWeekend(k) && s.weekend, k === today && s.today].filter(Boolean).join(" ")} aria-current={k === today ? "date" : undefined}>
                      <div className={s.cellHead}>
                        <Link href={`/calendar?view=week&week=${startOfWeek(k)}` as Route} className={s.num} aria-label={`${dayLabel(k)}${k === today ? ", today" : ""}: open the week`}>
                          {parseDayKey(k).day}
                        </Link>
                        {ps.length ? (
                          <span className={s.count}>
                            {ps.length} {ps.length === 1 ? "post" : "posts"}
                          </span>
                        ) : null}
                      </div>
                      {evs.map((ev) => (
                        <EventText key={ev.id} ev={ev} gaps={gapsOf(ev.id)} first={dayKey(ev.startsAt) === k} />
                      ))}
                      {ps.length ? <Marks posts={ps} late={late} /> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className={s.agenda} aria-label={`${title}, as a list`}>
        {busy.length ? (
          <ol className={s.alist}>
            {busy.map((k) => (
              <li key={k} className={`${s.aday} ${k === today ? s.today : ""}`}>
                <h2 className={s.adayHead}>
                  <span className={s.anum} aria-hidden="true">{parseDayKey(k).day}</span>
                  <span aria-hidden="true">{weekdayName(k)}</span>
                  <span className="visually-hidden">{dayLabel(k)}</span>
                  {k === today ? <span className={s.todayWord}>Today</span> : null}
                </h2>
                <div className={s.adayBody}>
                  {(evByDay.get(k) ?? []).map((ev) => (
                    <EventText key={ev.id} ev={ev} gaps={gapsOf(ev.id)} first={dayKey(ev.startsAt) === k} />
                  ))}
                  {(buckets.get(k) ?? []).length ? <Marks posts={buckets.get(k)!} late={late} max={12} labelled /> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty">Nothing planned this month.</p>
        )}
      </section>
    </>
  );
}

function Head(p: { title: string; sub: string; prev: string; next: string; today: string; unit: "week" | "month"; monthHref: string; weekHref: string; view: "week" | "month" }) {
  return (
    <header className={`page-head ${s.head}`}>
      <h1>
        {p.title} <span className={s.year}>{p.sub}</span>
      </h1>
      <nav aria-label="Calendar" className={s.nav}>
        <span className={s.views}>
          <Link href={p.monthHref as Route} aria-current={p.view === "month" ? "page" : undefined}>
            Month
          </Link>
          <Link href={p.weekHref as Route} aria-current={p.view === "week" ? "page" : undefined}>
            Week
          </Link>
        </span>
        <span className="btn-row">
          <Link href={p.prev as Route} className="btn btn-s" aria-label={`Previous ${p.unit}`}>
            <span aria-hidden="true">←</span>
          </Link>
          <Link href={p.today as Route} className="btn btn-s">
            Today
          </Link>
          <Link href={p.next as Route} className="btn btn-s" aria-label={`Next ${p.unit}`}>
            <span aria-hidden="true">→</span>
          </Link>
        </span>
      </nav>
    </header>
  );
}

function EventText({ ev, gaps, first }: { ev: EventLite; gaps: Gap[]; first: boolean }) {
  const cancelled = ev.status === "cancelled";
  return (
    <div className={`${s.ev} ${cancelled ? s.cancelled : ""}`}>
      <span className={`figures ${s.evTime}`}>{first ? fmtTime(ev.startsAt, true) : "Continues"}</span>
      <Link href={`/events/${ev.id}` as Route} className={s.evTitle}>
        {ev.title}
      </Link>
      {cancelled ? <span className={s.cancelWord}>Cancelled</span> : null}
      {gaps.map((g) => (
        <span key={g.type + (g.type === "missing" ? g.kind : "")} className={s.gap}>
          <Spark /> {gapLabel(g)}
        </span>
      ))}
    </div>
  );
}

/** Posts as small real graphics, each with its status mark; the rest as a count. */
function Marks({ posts, late, max = MAX_MARKS, labelled = false }: { posts: PostLite[]; late: (p: PostLite) => boolean; max?: number; labelled?: boolean }) {
  const shown = posts.slice(0, max);
  return (
    <ul className={`${s.marks} ${labelled ? s.labelled : ""}`}>
      {shown.map((p) => {
        const kind = KIND_LABEL[p.kind] ?? "Post";
        return (
          <li key={p.id}>
            <Link href={`/posts/${p.id}` as Route} className={s.mark} aria-label={`${kind}, ${STATUS_LABEL[p.status]}${p.scheduledFor ? `, ${fmtTime(p.scheduledFor, true)}` : ""}${p.eventTitle ? `, ${p.eventTitle}` : ""}${late(p) ? ", overdue" : ""}`} title={`${kind} · ${STATUS_LABEL[p.status]}${p.eventTitle ? ` · ${p.eventTitle}` : ""}`}>
              {p.cover ? <PostThumb slide={p.cover} format={p.format} width={labelled ? (p.format === "wide" ? 96 : p.format === "story" ? 44 : 64) : p.format === "wide" ? 56 : p.format === "story" ? 32 : 40} /> : null}
              {labelled ? (
                <span className={s.markText} aria-hidden="true">
                  <b>{kind}</b>
                  <span className="figures muted">{p.scheduledFor ? fmtTime(p.scheduledFor, true) : ""}</span>
                  <span className={`status status-${p.status}`}>{STATUS_LABEL[p.status]}</span>
                  {p.eventTitle ? <span className="muted">{p.eventTitle}</span> : null}
                </span>
              ) : (
                <span className={`status status-${p.status} ${s.markStatus}`} aria-hidden="true" />
              )}
              {late(p) ? <span className={s.markLate} aria-hidden="true"><Spark /></span> : null}
            </Link>
          </li>
        );
      })}
      {posts.length > max ? <li className={s.more}>+{posts.length - max}</li> : null}
    </ul>
  );
}
