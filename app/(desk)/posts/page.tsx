import { and, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PostThumb } from "@/components/post/PostThumb";
import { Spark } from "@/components/Spark";
import { StatusWord } from "@/components/StatusWord";
import { KIND_LABEL } from "@/lib/brand/presets";
import { can } from "@/lib/auth/rules";
import { getUser } from "@/lib/auth/session";
import { namesById } from "@/lib/data/users";
import { db, schema } from "@/lib/db";
import { TEMPLATES, type Format } from "@/lib/posts/types";
import { fmtDate, relativeDay } from "@/lib/time";
import styles from "./posts.module.css";

export const metadata: Metadata = { title: "Posts" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Waiting for you" },
  { key: "drafts", label: "Drafts" },
  { key: "review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "posted", label: "Posted" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const EMPTY: Record<FilterKey, { title: string; text: string }> = {
  all: { title: "No posts yet", text: "Add an event and it plans its posts for you, or start a standalone post for club news, photos or a blank canvas." },
  waiting: { title: "Nothing is waiting for you", text: "When someone asks you to review a post, it shows up here." },
  drafts: { title: "No drafts", text: "Every post being written shows up here until someone asks for review." },
  review: { title: "Nothing in review", text: "Open a draft and choose “Ask for review” when it’s ready for a second pair of eyes." },
  approved: { title: "Nothing approved and waiting to go out", text: "Approved posts wait here until someone marks them as posted." },
  posted: { title: "Nothing posted yet", text: "Once a post is live, mark it as posted in its review section and it moves here." },
};

function href(status: FilterKey, q: string): Route {
  const p = new URLSearchParams();
  if (status !== "all") p.set("status", status);
  if (q) p.set("q", q);
  const s = p.toString();
  return (s ? `/posts?${s}` : "/posts") as Route;
}

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const status: FilterKey = FILTERS.some((f) => f.key === sp.status) ? (sp.status as FilterKey) : "all";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const P = schema.posts;

  const waiting = and(
    eq(P.status, "in_review"),
    or(isNull(P.authorId), ne(P.authorId, user.id)),
    can(user.role, "post.approve") ? or(eq(P.reviewerId, user.id), isNull(P.reviewerId)) : eq(P.reviewerId, user.id),
  )!;
  const byFilter: Record<FilterKey, SQL | undefined> = {
    all: undefined,
    waiting,
    drafts: inArray(P.status, ["draft", "changes_requested"]),
    review: eq(P.status, "in_review"),
    approved: eq(P.status, "approved"),
    posted: eq(P.status, "posted"),
  };
  const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const search = like
    ? or(ilike(schema.events.title, like), sql`${P.slides}->0->'fields'->>'headline' ilike ${like}`, sql`${P.slides}->0->'fields'->>'series' ilike ${like}`)
    : undefined;

  const d = db();
  const [rows, counts, waitingCount, names] = await Promise.all([
    d
      .select({ post: P, eventTitle: schema.events.title })
      .from(P)
      .leftJoin(schema.events, eq(schema.events.id, P.eventId))
      .where(and(byFilter[status], search))
      .orderBy(desc(P.updatedAt))
      .limit(200),
    d.select({ status: P.status, n: sql<number>`count(*)::int` }).from(P).groupBy(P.status),
    d.select({ n: sql<number>`count(*)::int` }).from(P).where(waiting),
    namesById(),
  ]);
  const count = (k: FilterKey): number => {
    const by = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>;
    if (k === "all") return counts.reduce((a, c) => a + c.n, 0);
    if (k === "waiting") return waitingCount[0]?.n ?? 0;
    if (k === "drafts") return (by.draft ?? 0) + (by.changes_requested ?? 0);
    if (k === "review") return by.in_review ?? 0;
    return by[k] ?? 0;
  };
  const myWaiting = new Set(status === "waiting" ? rows.map((r) => r.post.id) : []);
  if (status !== "waiting") {
    for (const r of rows) {
      const p = r.post;
      if (p.status === "in_review" && p.authorId !== user.id && (p.reviewerId === user.id || (!p.reviewerId && can(user.role, "post.approve")))) myWaiting.add(p.id);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Posts</h1>
          <p>Every graphic the club is making, from first draft to posted. Event posts come from the event’s plan.</p>
        </div>
        <Link href="/posts/new" className="btn btn-primary">
          New post
        </Link>
      </header>

      <div className={styles.tools}>
        <nav aria-label="Filter posts by status" className={styles.filters}>
          {FILTERS.map((f) => {
            const n = count(f.key);
            return (
              <Link key={f.key} href={href(f.key, q)} className={styles.filter} aria-current={status === f.key ? "page" : undefined}>
                {f.key === "waiting" && n > 0 ? <Spark /> : null}
                {f.label}
                <span className={`figures ${styles.n}`}>{n}</span>
              </Link>
            );
          })}
        </nav>
        <form action="/posts" method="get" className={styles.search} role="search">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="q" className="visually-hidden">
            Search posts
          </label>
          <input id="q" name="q" type="search" className="input" defaultValue={q} placeholder="Headline or event" />
          <button type="submit" className="btn">
            Search
          </button>
          {q ? (
            <Link href={href(status, "")} className="btn btn-quiet">
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      {rows.length ? (
        <ol className={`ruled ${styles.list}`}>
          {rows.map(({ post: p, eventTitle }) => {
            const cover = p.slides[0];
            const fmts = cover ? TEMPLATES[cover.template].formats : (["feed"] as Format[]);
            const fmt = (p.formats as Format[]).find((f) => fmts.includes(f) && f !== "wide") ?? (p.formats as Format[]).find((f) => fmts.includes(f)) ?? fmts[0]!;
            const title = cover?.fields.headline.trim().split("\n")[0] || cover?.fields.series || "Untitled post";
            const author = p.authorId ? (p.authorId === user.id ? "You" : (names.get(p.authorId) ?? "Someone")) : "Someone";
            return (
              <li key={p.id} className={styles.row}>
                <Link href={`/posts/${p.id}` as Route} className={styles.thumb} tabIndex={-1} aria-hidden="true">
                  {cover ? <PostThumb slide={cover} format={fmt} width={fmt === "wide" ? 132 : 84} /> : null}
                </Link>
                <div className={styles.main}>
                  <h2 className={styles.title}>
                    {myWaiting.has(p.id) ? <Spark label="Waiting for your review" /> : null}
                    <Link href={`/posts/${p.id}` as Route}>{title}</Link>
                  </h2>
                  <p className={styles.sub}>
                    {eventTitle ? <span>{eventTitle}</span> : <span>Standalone</span>}
                    <span>{KIND_LABEL[p.kind] ?? "Post"}</span>
                    {p.slides.length > 1 ? <span>{p.slides.length} slides</span> : null}
                    <span>By {author}</span>
                  </p>
                </div>
                <div className={styles.side}>
                  <StatusWord status={p.status} />
                  <span className={styles.when}>
                    {p.scheduledFor ? (
                      <>
                        {relativeDay(p.scheduledFor).replace(/^./, (c) => c.toUpperCase())}, <span className="figures">{fmtDate(p.scheduledFor)}</span>
                      </>
                    ) : (
                      "Not scheduled"
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="empty">
          <strong>{q ? `Nothing matches “${q}”` : EMPTY[status].title}</strong>
          <p>{q ? "Try a word from the headline or the event’s name, or clear the search." : EMPTY[status].text}</p>
          {status === "all" && !q ? (
            <p className={`btn-row ${styles.emptyActions}`}>
              <Link href="/posts/new" className="btn btn-primary">
                Start a standalone post
              </Link>
              <Link href={"/events" as Route} className="btn">
                Go to events
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
