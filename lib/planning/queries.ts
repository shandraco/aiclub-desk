import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { can } from "@/lib/auth/rules";
import type { User } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { Format, Slide } from "@/lib/posts/types";
import { dayRange, findGaps, missingSlots, type Gap, type MissingSlot, type PostKind, type PostStatus } from "./index";

/**
 * Reads for the planning pages: events with their room, speakers and post plan; posts in a
 * date range; and what needs the signed-in person. Read-only; writes live in the actions.
 */

export interface PostLite {
  id: string;
  eventId: string | null;
  kind: PostKind;
  status: PostStatus;
  scheduledFor: Date | null;
  cover: Slide | null;
  format: Format;
  authorId: string | null;
  reviewerId: string | null;
  slideCount: number;
  eventTitle: string | null;
}

export interface EventLite {
  id: string;
  title: string;
  preset: string;
  seriesLabel: string;
  summary: string;
  startsAt: Date;
  endsAt: Date | null;
  status: "planned" | "cancelled";
  place: string;
  rsvpUrl: string;
  room: { name: string; short: string } | null;
  speakers: string[];
  partners: string[];
  rsvps: number | null;
  attendance: number | null;
  resultsNote: string;
}

const p = schema.posts;
const e = schema.events;

/** The format the thumbnail draws: feed when the post has it, else its first format. */
export function thumbFormat(formats: string[]): Format {
  if (formats.includes("feed")) return "feed";
  const f = formats[0];
  return f === "story" || f === "wide" ? f : "feed";
}

const postCols = {
  id: p.id,
  eventId: p.eventId,
  kind: p.kind,
  status: p.status,
  scheduledFor: p.scheduledFor,
  slides: p.slides,
  formats: p.formats,
  authorId: p.authorId,
  reviewerId: p.reviewerId,
  eventTitle: e.title,
};

type PostRow = { [K in keyof typeof postCols]: (typeof postCols)[K]["_"]["data"] } & { eventTitle: string | null };

function toLite(r: PostRow): PostLite {
  return {
    id: r.id,
    eventId: r.eventId,
    kind: r.kind,
    status: r.status,
    scheduledFor: r.scheduledFor,
    cover: r.slides[0] ?? null,
    format: thumbFormat(r.formats),
    authorId: r.authorId,
    reviewerId: r.reviewerId,
    slideCount: r.slides.length,
    eventTitle: r.eventTitle,
  };
}

const byTime = (a: PostLite, b: PostLite) => (a.scheduledFor?.getTime() ?? Infinity) - (b.scheduledFor?.getTime() ?? Infinity);

async function postsWhere(where: ReturnType<typeof and>): Promise<PostLite[]> {
  const rows = await db().select(postCols).from(p).leftJoin(e, eq(e.id, p.eventId)).where(where).orderBy(asc(p.scheduledFor), asc(p.createdAt));
  return rows.map((r) => toLite(r as PostRow));
}

export function postsInRange(from: Date, to: Date): Promise<PostLite[]> {
  return postsWhere(and(isNotNull(p.scheduledFor), gte(p.scheduledFor, from), lt(p.scheduledFor, to)));
}

export function postsForEvents(ids: string[]): Promise<PostLite[]> {
  if (!ids.length) return Promise.resolve([]);
  return postsWhere(and(inArray(p.eventId, ids)));
}

async function hydrate(rows: (typeof schema.events.$inferSelect & { roomName: string | null; roomShort: string | null })[]): Promise<EventLite[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [spk, prt] = await Promise.all([
    db()
      .select({ eventId: schema.eventSpeakers.eventId, name: schema.speakers.name })
      .from(schema.eventSpeakers)
      .innerJoin(schema.speakers, eq(schema.speakers.id, schema.eventSpeakers.speakerId))
      .where(inArray(schema.eventSpeakers.eventId, ids))
      .orderBy(asc(schema.eventSpeakers.sort)),
    db()
      .select({ eventId: schema.eventPartners.eventId, name: schema.partners.name })
      .from(schema.eventPartners)
      .innerJoin(schema.partners, eq(schema.partners.id, schema.eventPartners.partnerId))
      .where(inArray(schema.eventPartners.eventId, ids))
      .orderBy(asc(schema.eventPartners.sort)),
  ]);
  const group = (list: { eventId: string; name: string }[]) => {
    const m = new Map<string, string[]>();
    for (const x of list) m.set(x.eventId, [...(m.get(x.eventId) ?? []), x.name]);
    return m;
  };
  const sm = group(spk);
  const pm = group(prt);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    preset: r.preset,
    seriesLabel: r.seriesLabel,
    summary: r.summary,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    place: r.place,
    rsvpUrl: r.rsvpUrl,
    room: r.roomName ? { name: r.roomName, short: r.roomShort ?? r.roomName } : null,
    speakers: sm.get(r.id) ?? [],
    partners: pm.get(r.id) ?? [],
    rsvps: r.rsvps,
    attendance: r.attendance,
    resultsNote: r.resultsNote,
  }));
}

async function eventsWhere(where: ReturnType<typeof and> | undefined, order: "asc" | "desc" = "asc", limit?: number): Promise<EventLite[]> {
  const q = db()
    .select({ ev: e, roomName: schema.rooms.name, roomShort: schema.rooms.short })
    .from(e)
    .leftJoin(schema.rooms, eq(schema.rooms.id, e.roomId))
    .where(where)
    .orderBy(order === "asc" ? asc(e.startsAt) : desc(e.startsAt));
  const rows = limit ? await q.limit(limit) : await q;
  return hydrate(rows.map((r) => ({ ...r.ev, roomName: r.roomName, roomShort: r.roomShort })));
}

/** Events touching [from, to): starting in it, or running through it. */
export function eventsInRange(from: Date, to: Date): Promise<EventLite[]> {
  return eventsWhere(and(lt(e.startsAt, to), or(gte(e.startsAt, from), gte(e.endsAt, from))));
}

/** Upcoming (not yet over) or past events, for the events list. */
export function listEvents(which: "upcoming" | "past", now = new Date()): Promise<EventLite[]> {
  const over = sql`coalesce(${e.endsAt}, ${e.startsAt}) < ${now}`;
  return which === "upcoming"
    ? eventsWhere(sql`not (${over})`, "asc")
    : eventsWhere(over, "desc", 100);
}

export async function getEvent(id: string): Promise<EventLite | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [ev] = await eventsWhere(eq(e.id, id));
  return ev ?? null;
}

export async function eventCount(): Promise<number> {
  const [r] = await db().select({ n: sql<number>`count(*)::int` }).from(e);
  return r?.n ?? 0;
}

/** How many events each preset already has, for suggesting the next series number. */
export async function presetCounts(excludeId?: string): Promise<Record<string, number>> {
  const rows = await db()
    .select({ preset: e.preset, n: sql<number>`count(*)::int` })
    .from(e)
    .where(excludeId ? ne(e.id, excludeId) : undefined)
    .groupBy(e.preset);
  return Object.fromEntries(rows.map((r) => [r.preset, r.n]));
}

/** Rooms, speakers and partners for the event form (archived ones left out). */
export async function libraryChoices() {
  const [rooms, speakers, partners] = await Promise.all([
    db().select({ id: schema.rooms.id, name: schema.rooms.name, short: schema.rooms.short }).from(schema.rooms).where(isNull(schema.rooms.archivedAt)).orderBy(asc(schema.rooms.name)),
    db().select({ id: schema.speakers.id, name: schema.speakers.name, role: schema.speakers.role }).from(schema.speakers).where(isNull(schema.speakers.archivedAt)).orderBy(asc(schema.speakers.name)),
    db().select({ id: schema.partners.id, name: schema.partners.name }).from(schema.partners).where(isNull(schema.partners.archivedAt)).orderBy(asc(schema.partners.name)),
  ]);
  return { rooms, speakers, partners };
}

export async function eventLinks(id: string) {
  const [spk, prt, ev] = await Promise.all([
    db().select({ id: schema.eventSpeakers.speakerId }).from(schema.eventSpeakers).where(eq(schema.eventSpeakers.eventId, id)).orderBy(asc(schema.eventSpeakers.sort)),
    db().select({ id: schema.eventPartners.partnerId }).from(schema.eventPartners).where(eq(schema.eventPartners.eventId, id)).orderBy(asc(schema.eventPartners.sort)),
    db().select({ roomId: e.roomId }).from(e).where(eq(e.id, id)).limit(1),
  ]);
  return { speakerIds: spk.map((r) => r.id), partnerIds: prt.map((r) => r.id), roomId: ev[0]?.roomId ?? null };
}

/* ---------------- needs you ---------------- */

export interface NeedsYou {
  toReview: PostLite[];
  changesAsked: PostLite[];
  readyToPost: PostLite[];
  gaps: Gap[];
  /** Titles of events the gaps point at. */
  eventTitles: Map<string, string>;
  /** Posts the overdue gaps point at, for their thumbnails. */
  overduePosts: Map<string, PostLite>;
}

const DAY = 86_400_000;

export async function needsYou(user: User, now = new Date()): Promise<NeedsYou> {
  const mayApprove = can(user.role, "post.approve");
  const reviewWhere = mayApprove
    ? and(eq(p.status, "in_review"), or(eq(p.reviewerId, user.id), and(isNull(p.reviewerId), or(isNull(p.authorId), ne(p.authorId, user.id)))))
    : and(eq(p.status, "in_review"), eq(p.reviewerId, user.id));

  const soon = new Date(now.getTime() + 2 * DAY);
  const [toReview, changesAsked, readyToPost, gapEvents, overdueCandidates] = await Promise.all([
    postsWhere(reviewWhere),
    postsWhere(and(eq(p.status, "changes_requested"), eq(p.authorId, user.id))),
    mayApprove ? postsWhere(and(eq(p.status, "approved"), isNotNull(p.scheduledFor), lt(p.scheduledFor, soon))) : Promise.resolve([]),
    eventsInRange(new Date(now.getTime() - 32 * DAY), new Date(now.getTime() + 22 * DAY)),
    postsWhere(and(isNotNull(p.scheduledFor), lt(p.scheduledFor, now), gte(p.scheduledFor, new Date(now.getTime() - 60 * DAY)), inArray(p.status, ["draft", "in_review", "changes_requested"]))),
  ]);
  const eventPosts = await postsForEvents(gapEvents.map((x) => x.id));
  const all = new Map<string, PostLite>();
  for (const x of [...eventPosts, ...overdueCandidates]) all.set(x.id, x);
  // Overdue posts of events outside the window still need the cancelled check.
  const extraIds = [...new Set(overdueCandidates.map((x) => x.eventId).filter((id): id is string => !!id && !gapEvents.some((g) => g.id === id)))];
  const extraEvents = extraIds.length ? await eventsWhere(inArray(e.id, extraIds)) : [];
  const gapInputs = [...gapEvents, ...extraEvents];
  const gaps = findGaps(
    gapEvents,
    [...all.values()],
    now,
  ).filter((g) => g.type !== "overdue" || !extraEvents.some((x) => x.id === g.eventId && x.status === "cancelled"));
  return {
    toReview: toReview.filter((x) => x.authorId !== user.id || x.reviewerId === user.id).sort(byTime),
    changesAsked: changesAsked.sort(byTime),
    readyToPost: readyToPost.sort(byTime),
    gaps,
    eventTitles: new Map(gapInputs.map((x) => [x.id, x.title])),
    overduePosts: all,
  };
}

/* ---------------- week board ---------------- */

export interface BoardData {
  events: EventLite[];
  posts: PostLite[];
  slots: MissingSlot[];
}

/**
 * Everything a week board shows for [fromKey, fromKey + days): events, scheduled posts, and the
 * plan steps that should go out on those days but don't exist yet.
 */
export async function boardData(fromKey: string, days: number, now = new Date()): Promise<BoardData> {
  const { from, to } = dayRange(fromKey, days);
  // Plan steps run from 12 days before an event to 2 days after, so look that far around.
  const [context, posts] = await Promise.all([eventsInRange(new Date(from.getTime() - 3 * DAY), new Date(to.getTime() + 13 * DAY)), postsInRange(from, to)]);
  const contextPosts = await postsForEvents(context.map((x) => x.id));
  const events = context.filter((x) => x.startsAt.getTime() < to.getTime() && (x.endsAt ?? x.startsAt).getTime() >= from.getTime());
  return { events, posts, slots: missingSlots(context, contextPosts, fromKey, days, now) };
}
