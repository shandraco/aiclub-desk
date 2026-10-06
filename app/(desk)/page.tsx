import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PostThumb } from "@/components/post/PostThumb";
import { Spark } from "@/components/Spark";
import { StatusWord } from "@/components/StatusWord";
import { can } from "@/lib/auth/rules";
import { getUser } from "@/lib/auth/session";
import { KIND_LABEL, stepLabel } from "./events/_ui/labels";
import { isUrgent, parseDay, stepByKind, type Gap } from "@/lib/planning";
import { boardData, eventCount, needsYou, type PostLite } from "@/lib/planning/queries";
import { addDays, fmtDate, fmtTime, parseDayKey, relativeDay, startOfWeek, todayKey } from "@/lib/time";
import { addPlanStep } from "./events/actions";
import { ActionButton } from "./events/_ui/ActionForm";
import { monthName } from "./events/_ui/DateBlock";
import { WeekBoard } from "./events/_ui/WeekBoard";
import ui from "./events/_ui/ui.module.css";
import s from "./home.module.css";

export const metadata: Metadata = { title: "This week" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string; week?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const now = new Date();
  const today = todayKey();
  const thisWeek = startOfWeek(today);
  const asked = parseDay(sp.week);
  const week = asked ? startOfWeek(asked) : thisWeek;
  const first = user.displayName.split(" ")[0];
  const [total, board, needs] = await Promise.all([eventCount(), boardData(week, 7, now), needsYou(user, now)]);
  const mayWrite = can(user.role, "post.edit");

  const welcome =
    sp.welcome === "1" ? (
      <p className={`notice ${s.welcome}`} role="status">
        Welcome to the desk, {first}. This page is your week: what&rsquo;s waiting on you first, then every day&rsquo;s events and posts.
      </p>
    ) : null;

  if (total === 0) {
    return (
      <>
        <header className="page-head">
          <h1>This week</h1>
        </header>
        {welcome}
        <section className={s.firstRun} aria-labelledby="first-run">
          <h2 id="first-run" className={s.firstLead}>
            Nothing planned yet.
          </h2>
          <p>Start with an event. Type its date, room and speakers once; the desk drafts its announcement, LinkedIn post, reminder, day-of story and recap, each on its date, for a second officer to review.</p>
          {can(user.role, "event.edit") ? (
            <p>
              <Link href={"/events/new" as Route} className="btn btn-primary">
                Add your first event
              </Link>
            </p>
          ) : (
            <p className="muted">Ask an officer to add the first event; you can write its posts after that.</p>
          )}
        </section>
      </>
    );
  }

  const items = needItems(needs, now, mayWrite);
  const end = addDays(week, 6);
  const range = `${monthName(week)} ${parseDayKey(week).day} to ${monthName(end) !== monthName(week) ? `${monthName(end)} ` : ""}${parseDayKey(end).day}`;

  return (
    <>
      <header className={`page-head ${s.head}`}>
        <div>
          <h1>This week</h1>
          <p>{first ? `${first}, here` : "Here"}&rsquo;s what&rsquo;s waiting on you, then the week. All times Wichita.</p>
        </div>
      </header>
      {welcome}

      <section aria-labelledby="needs-head" className={s.needs}>
        <h2 id="needs-head" className={s.sectionHead}>
          Needs you
          {items.length ? <span className={`figures ${s.count}`}>{items.length}</span> : null}
        </h2>
        {items.length ? (
          <ol className={s.strip}>
            {items.map((it) => (
              <li key={it.key} className={`${s.need} ${it.urgent ? s.urgent : ""}`}>
                <div className={s.needVisual}>
                  {it.post?.cover ? (
                    <Link href={`/posts/${it.post.id}` as Route} tabIndex={-1} aria-hidden="true">
                      <PostThumb slide={it.post.cover} format={it.post.format} width={(it.urgent ? 1 : 0.75) * (it.post.format === "story" ? 110 : it.post.format === "wide" ? 196 : 150)} />
                    </Link>
                  ) : (
                    <span className={`${ui.hatch} ${s.needHatch}`} aria-hidden="true" />
                  )}
                </div>
                <div className={s.needText}>
                  <p className={s.needWhat}>
                    {it.urgent ? <Spark label="Urgent" /> : null}
                    <b>{it.what}</b>
                  </p>
                  <p className={s.needSub}>{it.sub}</p>
                  {it.post ? <StatusWord status={it.post.status} /> : null}
                </div>
                <div className={s.needAction}>{it.action}</div>
              </li>
            ))}
          </ol>
        ) : (
          <p className={s.calm}>Nothing needs you. Reviews you&rsquo;re asked for, and gaps in the plan, show up here.</p>
        )}
      </section>

      <section aria-labelledby="board-head" className={s.boardWrap}>
        <div className={s.boardBar}>
          <h2 id="board-head" className={s.sectionHead}>
            {week === thisWeek ? "This week" : week === addDays(thisWeek, 7) ? "Next week" : "Week of"} <span className={s.range}>{range}</span>
          </h2>
          <nav aria-label="Which week" className={s.toggle}>
            <Link href={"/" as Route} aria-current={week === thisWeek ? "page" : undefined}>
              This week
            </Link>
            <Link href={`/?week=${addDays(thisWeek, 7)}` as Route} aria-current={week === addDays(thisWeek, 7) ? "page" : undefined}>
              Next week
            </Link>
            <Link href={`/calendar?month=${week.slice(0, 7)}` as Route}>Month</Link>
          </nav>
        </div>
        <WeekBoard fromKey={week} data={board} today={today} now={now} mayWrite={mayWrite} label={`Days of the week, ${range}`} />
      </section>
    </>
  );
}

interface NeedItem {
  key: string;
  post?: PostLite;
  what: string;
  sub: string;
  urgent: boolean;
  /** Sort: soonest due first. */
  due: number;
  action: ReactNode;
}

function needItems(needs: Awaited<ReturnType<typeof needsYou>>, now: Date, mayWrite: boolean): NeedItem[] {
  const out: NeedItem[] = [];
  const kind = (p: PostLite) => KIND_LABEL[p.kind] ?? "Post";
  const when = (p: PostLite) => (p.scheduledFor ? `${relativeDay(p.scheduledFor, now)}, ${fmtTime(p.scheduledFor, true)}` : "not scheduled");
  const seen = new Set<string>();
  const postLink = (p: PostLite, label: string) => (
    <Link href={`/posts/${p.id}` as Route} className="btn btn-primary btn-s">
      {label}
      <span className="visually-hidden">: {kind(p)}{p.eventTitle ? `, ${p.eventTitle}` : ""}</span>
    </Link>
  );
  for (const p of needs.toReview) {
    seen.add(p.id);
    out.push({ key: `r-${p.id}`, post: p, what: `Review the ${kind(p).toLowerCase()}`, sub: `${p.eventTitle ?? "No event"} · goes out ${when(p)}`, urgent: isUrgent(p.scheduledFor, now, 48), due: p.scheduledFor?.getTime() ?? Infinity, action: postLink(p, "Review") });
  }
  for (const p of needs.changesAsked) {
    seen.add(p.id);
    out.push({ key: `c-${p.id}`, post: p, what: "Make the changes asked for", sub: `${kind(p)} · ${p.eventTitle ?? "No event"} · ${when(p)}`, urgent: isUrgent(p.scheduledFor, now, 48), due: p.scheduledFor?.getTime() ?? Infinity, action: postLink(p, "Open") });
  }
  for (const p of needs.readyToPost) {
    seen.add(p.id);
    const late = !!p.scheduledFor && p.scheduledFor.getTime() < now.getTime();
    out.push({ key: `p-${p.id}`, post: p, what: late ? "Approved, and late: post it" : "Approved: post it", sub: `${kind(p)} · ${p.eventTitle ?? "No event"} · ${late ? "was due" : "goes out"} ${when(p)}`, urgent: isUrgent(p.scheduledFor, now, 24), due: p.scheduledFor?.getTime() ?? Infinity, action: postLink(p, "Export and post") });
  }
  for (const g of needs.gaps) out.push(...gapItem(g, needs, now, mayWrite, seen, postLink));
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.due - b.due);
}

function gapItem(g: Gap, needs: Awaited<ReturnType<typeof needsYou>>, now: Date, mayWrite: boolean, seen: Set<string>, postLink: (p: PostLite, label: string) => ReactNode): NeedItem[] {
  if (g.type === "overdue") {
    if (seen.has(g.postId)) return [];
    const p = needs.overduePosts.get(g.postId);
    if (!p) return [];
    return [{ key: `o-${p.id}`, post: p, what: `${KIND_LABEL[p.kind] ?? "Post"} is overdue`, sub: `${p.eventTitle ?? "No event"} · was due ${relativeDay(g.scheduledFor, now)}`, urgent: true, due: g.scheduledFor.getTime(), action: postLink(p, "Finish or move it") }];
  }
  const title = needs.eventTitles.get(g.eventId) ?? "Event";
  const kind = g.type === "missing" ? g.kind : "recap";
  const step = stepByKind(kind)!;
  const due = g.type === "missing" ? g.due : g.endedAt;
  const sub = g.type === "missing" ? `${title} · ${relativeDay(g.eventStart, now)}, ${fmtDate(g.eventStart)}` : `${title} · was ${relativeDay(g.endedAt, now)}`;
  return [
    {
      key: `${g.type}-${g.eventId}-${kind}`,
      what: `No ${stepLabel(kind)} yet`,
      sub,
      urgent: g.type === "no_recap" || due.getTime() < now.getTime() + 2 * 86_400_000,
      due: due.getTime(),
      action: mayWrite ? (
        <ActionButton action={addPlanStep} fields={{ eventId: g.eventId, kind: step.kind }} pendingLabel="Making…" className="btn btn-primary btn-s">
          Add {stepLabel(kind)}
          <span className="visually-hidden"> for {title}</span>
        </ActionButton>
      ) : (
        <Link href={`/events/${g.eventId}` as Route} className="btn btn-s">
          Open the event
        </Link>
      ),
    },
  ];
}
