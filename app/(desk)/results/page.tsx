import type { Metadata, Route } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { PostThumb } from "@/components/post/PostThumb";
import { Spark } from "@/components/Spark";
import { KIND_LABEL, presetByKey } from "@/lib/brand/presets";
import { can } from "@/lib/auth/rules";
import { requireUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { whatWorked } from "@/lib/team/results";
import { fmtDate, fmtDateYear } from "@/lib/time";
import { channelLabel, METRICS, type MetricKey } from "./metrics";
import { ResultsButton, type ChannelNumbers } from "./ResultsForm";
import styles from "./results.module.css";

export const metadata: Metadata = { title: "Results" };

const n = (v: number | null | undefined) => (v === null || v === undefined ? null : v);

export default async function ResultsPage() {
  const user = await requireUser();
  const mayEdit = can(user.role, "results.edit");
  const d = db();

  const posts = await d
    .select({
      id: schema.posts.id,
      kind: schema.posts.kind,
      slides: schema.posts.slides,
      formats: schema.posts.formats,
      channels: schema.posts.channels,
      postedAt: schema.posts.postedAt,
      postedUrls: schema.posts.postedUrls,
      eventId: schema.events.id,
      eventTitle: schema.events.title,
      eventPreset: schema.events.preset,
    })
    .from(schema.posts)
    .leftJoin(schema.events, eq(schema.events.id, schema.posts.eventId))
    .where(eq(schema.posts.status, "posted"))
    .orderBy(sql`${schema.posts.postedAt} desc nulls last`, desc(schema.posts.updatedAt))
    .limit(200);

  const results = posts.length
    ? await d.select().from(schema.postResults).where(inArray(schema.postResults.postId, posts.map((p) => p.id)))
    : [];
  const byPost = new Map<string, Map<string, (typeof results)[number]>>();
  for (const r of results) {
    if (!byPost.has(r.postId)) byPost.set(r.postId, new Map());
    byPost.get(r.postId)!.set(r.channel, r);
  }

  const events = await d
    .select({ id: schema.events.id, title: schema.events.title, startsAt: schema.events.startsAt, rsvps: schema.events.rsvps, attendance: schema.events.attendance })
    .from(schema.events)
    .where(and(lt(schema.events.startsAt, new Date()), eq(schema.events.status, "planned")))
    .orderBy(desc(schema.events.startsAt))
    .limit(60);

  const summary = whatWorked(
    posts.map((p) => ({
      series: p.eventPreset ? presetByKey(p.eventPreset).name : null,
      kind: KIND_LABEL[p.kind] ?? "Other",
      reach: p.channels.map((c) => ({ channel: channelLabel(c), reach: n(byPost.get(p.id)?.get(c)?.reach) })),
    })),
    events,
  );
  const max = Math.max(1, ...events.flatMap((e) => [e.rsvps ?? 0, e.attendance ?? 0]));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Results</h1>
          <p>What happened after posting. Copy the numbers from Instagram and LinkedIn insights a few days after each post, and the turnout after each event.</p>
        </div>
      </header>

      <section className="panel" aria-labelledby="worked-h">
        <h2 id="worked-h">What worked</h2>
        {summary.length ? (
          <ul className={`read ${styles.worked}`}>
            {summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <p className={`muted ${styles.measure}`}>
            Not enough numbers to compare yet. A comparison shows up once each side has at least two posts with reach recorded, so one lucky post doesn’t read as a pattern.
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="posts-h">
        <h2 id="posts-h">
          Posted <small>{posts.length === 1 ? "1 post" : `${posts.length} posts`}, newest first</small>
        </h2>
        {posts.length === 0 ? (
          <div className="empty">
            <strong>Nothing posted yet.</strong>
            When a post is marked posted, it shows up here so you can log its reach, likes and clicks per channel.
          </div>
        ) : (
          <div className={styles.scroll} role="region" aria-labelledby="posts-h">
            <table className={`table ${styles.posts}`}>
              <thead>
                <tr>
                  <th scope="col">Post</th>
                  <th scope="col">Posted</th>
                  <th scope="col">Channel</th>
                  {METRICS.map((m) => (
                    <th key={m.key} scope="col" className="num">{m.label}</th>
                  ))}
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              {posts.map((p) => {
                const title = p.slides[0]?.fields.headline?.trim() || p.eventTitle || KIND_LABEL[p.kind] || "Untitled post";
                const rs = byPost.get(p.id);
                const current: ChannelNumbers = Object.fromEntries(
                  p.channels.map((c) => [c, Object.fromEntries(METRICS.map((m) => [m.key, n(rs?.get(c)?.[m.key])])) as Record<MetricKey, number | null>]),
                );
                const missing = p.channels.every((c) => !rs?.get(c));
                const span = Math.max(1, p.channels.length);
                return (
                  <tbody key={p.id} className={styles.group}>
                    {(p.channels.length ? p.channels : [""]).map((c, i) => {
                      const r = rs?.get(c);
                      const url = c ? p.postedUrls?.[c] : undefined;
                      return (
                        <tr key={c || "none"}>
                          {i === 0 ? (
                            <th scope="rowgroup" rowSpan={span} className={styles.post}>
                              <div className={styles.postCell}>
                                {p.slides[0] ? <PostThumb slide={p.slides[0]} format={(p.formats[0] as "feed" | "story" | "wide") ?? "feed"} width={64} /> : null}
                                <div>
                                  <Link href={`/posts/${p.id}` as Route} className={styles.title}>{title}</Link>
                                  <p className="muted">
                                    {KIND_LABEL[p.kind] ?? "Post"}
                                    {p.eventTitle ? <> for {p.eventId ? <Link href={`/events/${p.eventId}` as Route}>{p.eventTitle}</Link> : p.eventTitle}</> : null}
                                  </p>
                                  {missing && mayEdit ? (
                                    <p className={styles.attn}><Spark /> No numbers yet</p>
                                  ) : null}
                                </div>
                              </div>
                            </th>
                          ) : null}
                          {i === 0 ? (
                            <td rowSpan={span} className={styles.nowrap} data-label="Posted">{p.postedAt ? fmtDateYear(p.postedAt) : "—"}</td>
                          ) : null}
                          <td className={styles.nowrap} data-label="Channel">
                            {c ? url ? <a href={url} target="_blank" rel="noreferrer">{channelLabel(c)}<span className="visually-hidden"> (live post, opens in a new tab)</span></a> : channelLabel(c) : "—"}
                          </td>
                          {METRICS.map((m) => {
                            const v = n(r?.[m.key]);
                            return (
                              <td key={m.key} className="num" data-label={m.label}>
                                {v === null ? <><span className="muted" aria-hidden="true">—</span><span className="visually-hidden">not recorded</span></> : v.toLocaleString("en-US")}
                              </td>
                            );
                          })}
                          {i === 0 ? (
                            <td rowSpan={span} className={`${styles.actions} ${styles.full}`}>
                              {mayEdit && p.channels.length ? <ResultsButton postId={p.id} title={title} channels={p.channels} current={current} has={!missing} /> : null}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="events-h">
        <h2 id="events-h">
          Turnout <small>RSVPs and the people who came, past events</small>
        </h2>
        {events.length === 0 ? (
          <div className="empty">
            <strong>No past events yet.</strong>
            After an event, record its RSVPs and head count on the event page; they show up here side by side.
          </div>
        ) : (
          <>
            <div className={styles.scroll} role="region" aria-labelledby="events-h">
              <table className={`table ${styles.events}`}>
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">Date</th>
                    <th scope="col">RSVPs and turnout</th>
                    <th scope="col" className="num">Came / RSVPs</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const none = e.rsvps === null && e.attendance === null;
                    return (
                      <tr key={e.id}>
                        <th scope="row" className={styles.post}>
                          <Link href={`/events/${e.id}` as Route} className={styles.title}>{e.title}</Link>
                        </th>
                        <td className={styles.nowrap} data-label="Date">{fmtDate(e.startsAt)}</td>
                        <td className={styles.barCell}>
                          {none ? (
                            <span className={styles.attn}>
                              <Spark /> Not recorded. <Link href={`/events/${e.id}` as Route}>Add turnout</Link>
                            </span>
                          ) : (
                            <div className={styles.bars}>
                              <Bar label="RSVPs" value={e.rsvps} max={max} kind="rsvp" />
                              <Bar label="Came" value={e.attendance} max={max} kind="came" />
                            </div>
                          )}
                        </td>
                        <td className="num" data-label="Came / RSVPs">
                          {e.rsvps && e.attendance !== null ? `${Math.round((e.attendance / e.rsvps) * 100)}%` : <span className="muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function Bar({ label, value, max, kind }: { label: string; value: number | null; max: number; kind: "rsvp" | "came" }) {
  return (
    <div className={styles.bar}>
      <span className={styles.barLabel}>{label}</span>
      <span className={styles.track}>
        {value !== null ? <span className={kind === "rsvp" ? styles.fillRsvp : styles.fillCame} style={{ inlineSize: `${(value / max) * 100}%` }} /> : null}
      </span>
      <span className={`figures ${styles.barValue}`}>{value === null ? "not recorded" : value.toLocaleString("en-US")}</span>
    </div>
  );
}
