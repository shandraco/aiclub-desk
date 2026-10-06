import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PostThumb } from "@/components/post/PostThumb";
import { Spark } from "@/components/Spark";
import { StatusWord } from "@/components/StatusWord";
import { can } from "@/lib/auth/rules";
import { getUser } from "@/lib/auth/session";
import { EVENT_PLAN, presetByKey, type PlanStep } from "@/lib/brand/presets";
import { findGaps, gapLabel, missingSteps, type Gap } from "@/lib/planning";
import { listEvents, postsForEvents, type EventLite, type PostLite } from "@/lib/planning/queries";
import { dayKey, fmtDateYear, fmtTime } from "@/lib/time";
import { DateBlock } from "./_ui/DateBlock";
import { KIND_LABEL, stepLabel } from "./_ui/labels";
import { THUMB } from "./_ui/PostChip";
import ui from "./_ui/ui.module.css";
import s from "./events.module.css";

export const metadata: Metadata = { title: "Events" };

const RECENT_PAST = 8;

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ show?: string; deleted?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const allPast = sp.show === "past";
  const now = new Date();
  const [upcoming, past] = await Promise.all([allPast ? Promise.resolve([]) : listEvents("upcoming", now), listEvents("past", now)]);
  const shownPast = allPast ? past : past.slice(0, RECENT_PAST);
  const posts = await postsForEvents([...upcoming, ...shownPast].map((e) => e.id));
  const gaps = findGaps(upcoming, posts, now, { horizonDays: 366 });
  const mayEdit = can(user.role, "event.edit");

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{allPast ? "Past events" : "Events"}</h1>
          <p>{allPast ? "Everything the club has run, newest first, with what went out and who came." : "Each event with its post plan. Hatched slots are posts that don’t exist yet; gold means one is due soon."}</p>
        </div>
        <div className="btn-row">
          {allPast ? (
            <Link href={"/events" as Route} className="btn">
              Upcoming events
            </Link>
          ) : null}
          {mayEdit ? (
            <Link href={"/events/new" as Route} className="btn btn-primary">
              New event
            </Link>
          ) : null}
        </div>
      </header>

      {sp.deleted ? (
        <p className={`notice ${s.notice}`} role="status">
          Event deleted, with its unpublished posts.
        </p>
      ) : null}

      {!allPast ? (
        upcoming.length ? (
          <section aria-labelledby="up-head" className={s.upcoming}>
            <h2 id="up-head" className="visually-hidden">
              Upcoming
            </h2>
            <ol className={s.list}>
              {upcoming.map((ev) => (
                <UpcomingRow key={ev.id} ev={ev} posts={posts.filter((p) => p.eventId === ev.id)} gaps={gaps.filter((g) => g.type !== "overdue" && g.eventId === ev.id)} />
              ))}
            </ol>
          </section>
        ) : (
          <div className={`empty ${s.emptyUp}`}>
            <strong>Nothing coming up.</strong>
            Add the next event and the desk drafts its announcement, LinkedIn post, reminder, day-of story and recap, each on its date.
            {mayEdit ? (
              <p className={s.emptyAction}>
                <Link href={"/events/new" as Route} className="btn btn-primary">
                  Add an event
                </Link>
              </p>
            ) : null}
          </div>
        )
      ) : null}

      <section aria-labelledby="past-head" className={s.past}>
        {!allPast ? (
          <h2 id="past-head" className={s.pastHead}>
            Past
            {past.length > RECENT_PAST ? (
              <Link href={"/events?show=past" as Route} className={s.pastAll}>
                All {past.length} past events
              </Link>
            ) : null}
          </h2>
        ) : (
          <h2 id="past-head" className="visually-hidden">
            Past events
          </h2>
        )}
        {shownPast.length ? (
          <ol className={s.pastList}>
            {shownPast.map((ev) => (
              <PastRow key={ev.id} ev={ev} posts={posts.filter((p) => p.eventId === ev.id)} />
            ))}
          </ol>
        ) : (
          <p className="muted">No past events yet. Events move here once they&rsquo;re over.</p>
        )}
      </section>
    </>
  );
}

function UpcomingRow({ ev, posts, gaps }: { ev: EventLite; posts: PostLite[]; gaps: Gap[] }) {
  const cancelled = ev.status === "cancelled";
  const where = ev.room?.name || ev.place;
  const missing = cancelled ? [] : missingSteps(posts.map((p) => p.kind));
  const flagged = new Map<string, Gap>(gaps.map((g) => [g.type === "missing" ? g.kind : "recap", g]));
  // The plan in its own order, missing steps in place, other posts after.
  const ordered: ({ p: PostLite } | { step: PlanStep })[] = [];
  for (const st of EVENT_PLAN) {
    for (const p of posts.filter((x) => x.kind === st.kind)) ordered.push({ p });
    if (missing.includes(st)) ordered.push({ step: st });
  }
  for (const p of posts.filter((x) => !EVENT_PLAN.some((st) => st.kind === x.kind))) ordered.push({ p });
  const made = posts.length;
  return (
    <li className={`${s.row} ${cancelled ? s.cancelled : ""}`}>
      <DateBlock day={dayKey(ev.startsAt)} />
      <div className={s.facts}>
        <p className={s.series}>{ev.seriesLabel || presetByKey(ev.preset).name}</p>
        <h3 className={s.title}>
          <Link href={`/events/${ev.id}` as Route}>{ev.title}</Link>
        </h3>
        <p className={s.meta}>{[`${fmtTime(ev.startsAt, true)}${ev.endsAt ? ` to ${fmtTime(ev.endsAt, true)}` : ""}`, where].filter(Boolean).join(" · ")}</p>
        {ev.speakers.length ? <p className={s.speakers}>With {ev.speakers.join(", ")}</p> : null}
        {cancelled ? <p className={s.cancelWord}>Cancelled</p> : null}
      </div>
      <div className={s.plan}>
        <p className="visually-hidden">
          Post plan: {made} {made === 1 ? "post" : "posts"} made{missing.length ? `, ${missing.length} not made yet` : ""}.
        </p>
        <ul className={s.strip}>
          {ordered.map((item) =>
            "step" in item ? (
              <li key={item.step.kind} className={s.item}>
                <span className={s.frame}>
                  <span className={`${ui.hatch} ${s.slot}`} style={{ inlineSize: THUMB.m[item.step.formats[0] ?? "feed"], aspectRatio: item.step.formats[0] === "story" ? "9 / 16" : "4 / 5" }} aria-hidden="true" />
                </span>
                <span className={s.itemText}>
                  <span className={s.kind}>{KIND_LABEL[item.step.kind]}</span>
                  {flagged.has(item.step.kind) ? (
                    <span className={ui.flag}>
                      <Spark /> {gapLabel(flagged.get(item.step.kind)!)}
                    </span>
                  ) : (
                    <span className="muted">No {stepLabel(item.step.kind)} yet</span>
                  )}
                </span>
              </li>
            ) : (
              <li key={item.p.id} className={s.item}>
                <Link href={`/posts/${item.p.id}` as Route} className={s.postLink}>
                  <span className={s.frame}>{item.p.cover ? <PostThumb slide={item.p.cover} format={item.p.format} width={THUMB.m[item.p.format]} /> : null}</span>
                  <span className={s.itemText}>
                    <span className={s.kind}>{KIND_LABEL[item.p.kind] ?? "Post"}</span>
                    <StatusWord status={item.p.status} />
                    {cancelled && item.p.status !== "posted" ? (
                      <span className={ui.flag}>
                        <Spark /> Event cancelled
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ),
          )}
        </ul>
      </div>
    </li>
  );
}

function PastRow({ ev, posts }: { ev: EventLite; posts: PostLite[] }) {
  const posted = posts.filter((p) => p.status === "posted").length;
  const recap = posts.some((p) => p.kind === "recap");
  return (
    <li className={`${s.pastRow} ${ev.status === "cancelled" ? s.cancelled : ""}`}>
      <span className={`figures ${s.pastDate}`}>{fmtDateYear(ev.startsAt)}</span>
      <span className={s.pastTitle}>
        <Link href={`/events/${ev.id}` as Route}>{ev.title}</Link>
        <span className="muted"> · {ev.seriesLabel || presetByKey(ev.preset).name}</span>
      </span>
      <span className={s.pastNums}>
        {ev.status === "cancelled" ? (
          <span className={s.cancelWord}>Cancelled</span>
        ) : (
          <>
            <span>
              {posted} of {posts.length} posted
            </span>
            <span>{ev.attendance !== null ? `${ev.attendance} came` : "Turnout not logged"}</span>
            {!recap ? <span className="muted">No recap</span> : null}
          </>
        )}
      </span>
    </li>
  );
}
