"use server";

import { and, desc, ilike, isNull, or, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { KIND_LABEL } from "@/lib/brand/presets";
import { db, schema } from "@/lib/db";
import { fmtDate } from "@/lib/time";

export interface Hit {
  kind: "event" | "post" | "speaker" | "partner";
  id: string;
  title: string;
  detail: string;
  href: string;
}

/** Search across the desk for the command bar: events, posts, speakers, partners. */
export async function searchDesk(query: string): Promise<Hit[]> {
  await requireUser();
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const d = db();
  const headline = sql<string>`${schema.posts.slides}->0->'fields'->>'headline'`;
  const [events, posts, speakers, partners] = await Promise.all([
    d.select({ id: schema.events.id, title: schema.events.title, startsAt: schema.events.startsAt, series: schema.events.seriesLabel })
      .from(schema.events).where(or(ilike(schema.events.title, like), ilike(schema.events.seriesLabel, like))).orderBy(desc(schema.events.startsAt)).limit(5),
    d.select({ id: schema.posts.id, headline, kind: schema.posts.kind, status: schema.posts.status })
      .from(schema.posts).where(ilike(headline, like)).orderBy(desc(schema.posts.updatedAt)).limit(5),
    d.select({ id: schema.speakers.id, name: schema.speakers.name, role: schema.speakers.role })
      .from(schema.speakers).where(and(isNull(schema.speakers.archivedAt), ilike(schema.speakers.name, like))).limit(4),
    d.select({ id: schema.partners.id, name: schema.partners.name })
      .from(schema.partners).where(and(isNull(schema.partners.archivedAt), ilike(schema.partners.name, like))).limit(4),
  ]);
  return [
    ...events.map((e) => ({ kind: "event" as const, id: e.id, title: e.title, detail: [e.series, fmtDate(e.startsAt)].filter(Boolean).join(" · "), href: `/events/${e.id}` })),
    ...posts.map((p) => ({ kind: "post" as const, id: p.id, title: (p.headline || "Untitled").split("\n")[0]!, detail: `${KIND_LABEL[p.kind] ?? "Post"} · ${p.status.replace("_", " ")}`, href: `/posts/${p.id}` })),
    ...speakers.map((s) => ({ kind: "speaker" as const, id: s.id, title: s.name, detail: s.role || "Speaker", href: `/library/speakers?q=${encodeURIComponent(s.name)}` })),
    ...partners.map((p) => ({ kind: "partner" as const, id: p.id, title: p.name, detail: "Partner", href: `/library/partners?q=${encodeURIComponent(p.name)}` })),
  ];
}
