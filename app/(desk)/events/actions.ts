"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, fieldErrors, formValues, isNextControlFlow, UserError, type FormState } from "@/lib/actions";
import { requirePermission, type User } from "@/lib/auth/session";
import { EVENT_PLAN, EVENT_PRESETS } from "@/lib/brand/presets";
import { loadEventContext } from "@/lib/data/events";
import { db, schema } from "@/lib/db";
import { planDates, stepByKind } from "@/lib/planning";
import { emptyCaptions, slideForEvent } from "@/lib/posts/factory";
import { createPost, deletePost, saveContent } from "@/lib/posts/workflow";
import { addDays, dayKey, fromLocalInput, parseDayKey, fromZoned, zoned } from "@/lib/time";

/*
 * Event writes. Every action checks the session and role itself, validates with zod, looks up
 * every ID it was sent, and creates posts only through lib/posts/workflow.ts.
 */

const UUID = z.string().uuid();
const PRESET_KEYS = EVENT_PRESETS.map((p) => p.key) as [string, ...string[]];
const STEP_KINDS = EVENT_PLAN.map((s) => s.kind) as [string, ...string[]];

const EventInput = z
  .object({
    id: UUID.optional(),
    title: z.string().trim().min(1, "Give the event a title.").max(90, "Keep the title under 90 characters; it is the graphic's headline."),
    preset: z.enum(PRESET_KEYS, { message: "Pick a series." }),
    seriesLabel: z.string().trim().max(40, "Keep the series label under 40 characters."),
    summary: z.string().trim().max(240, "Keep the summary to one sentence, under 240 characters."),
    startsAt: z.string().transform((v, ctx) => {
      const d = fromLocalInput(v);
      if (!d) ctx.addIssue({ code: "custom", message: "Enter the date and time it starts." });
      return d ?? new Date(0);
    }),
    endsAt: z.string().transform((v, ctx) => {
      if (!v) return null;
      const d = fromLocalInput(v);
      if (!d) ctx.addIssue({ code: "custom", message: "Enter a valid end, or leave it empty." });
      return d;
    }),
    roomId: z.union([z.literal(""), UUID]).transform((v) => v || null),
    place: z.string().trim().max(80, "Keep the place under 80 characters."),
    rsvpUrl: z
      .string()
      .trim()
      .max(500, "That link is too long.")
      .refine((v) => v === "" || /^https:\/\/[^\s/$.?#][^\s]*$/i.test(v), "Use a full https:// link, or leave it empty."),
    speakers: z.array(UUID).max(4, "A graphic fits 4 speakers at most."),
    partners: z.array(UUID).max(3, "A graphic fits 3 partner logos at most."),
    plan: z.array(z.enum(STEP_KINDS)),
    movePosts: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.endsAt && v.endsAt.getTime() <= v.startsAt.getTime()) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end has to be after the start." });
    if (!v.roomId && !v.place) ctx.addIssue({ code: "custom", path: ["roomId"], message: "Pick a room, or write where it is in the place box." });
    if (new Set(v.speakers).size !== v.speakers.length) ctx.addIssue({ code: "custom", path: ["speakers"], message: "Each speaker once, please." });
  });

function readEvent(fd: FormData) {
  const s = (k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");
  return EventInput.safeParse({
    id: s("id") || undefined,
    title: s("title"),
    preset: s("preset"),
    seriesLabel: s("seriesLabel"),
    summary: s("summary"),
    startsAt: s("startsAt"),
    endsAt: s("endsAt"),
    roomId: s("roomId"),
    place: s("place"),
    rsvpUrl: s("rsvpUrl"),
    speakers: fd.getAll("speakers").filter((x) => typeof x === "string"),
    partners: fd.getAll("partners").filter((x) => typeof x === "string"),
    plan: fd.getAll("plan").filter((x) => typeof x === "string"),
    movePosts: fd.get("movePosts") === "on",
  });
}

/** Checks that every room, speaker and partner the form sent exists and is not archived. */
async function checkLinks(v: { roomId: string | null; speakers: string[]; partners: string[] }): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};
  if (v.roomId) {
    const [r] = await db().select({ id: schema.rooms.id }).from(schema.rooms).where(and(eq(schema.rooms.id, v.roomId), isNull(schema.rooms.archivedAt))).limit(1);
    if (!r) errors.roomId = "That room is no longer in the library. Pick another.";
  }
  if (v.speakers.length) {
    const rows = await db().select({ id: schema.speakers.id }).from(schema.speakers).where(and(inArray(schema.speakers.id, v.speakers), isNull(schema.speakers.archivedAt)));
    if (rows.length !== v.speakers.length) errors.speakers = "One of those speakers is no longer in the library. Check the list.";
  }
  if (v.partners.length) {
    const rows = await db().select({ id: schema.partners.id }).from(schema.partners).where(and(inArray(schema.partners.id, v.partners), isNull(schema.partners.archivedAt)));
    if (rows.length !== v.partners.length) errors.partners = "One of those partners is no longer in the library. Check the list.";
  }
  return errors;
}

/** Creates one plan step's post for an event, on its computed date. */
async function createStepPost(user: User, eventId: string, kind: string): Promise<string> {
  const step = stepByKind(kind);
  if (!step) throw new UserError("That isn't a step in the post plan.");
  const ctx = await loadEventContext(eventId);
  if (!ctx) throw new UserError("That event no longer exists.");
  const [planned] = planDates(ctx.startsAt, [step]);
  const row = await createPost(user, {
    eventId,
    kind: step.kind,
    preset: ctx.preset,
    slides: [slideForEvent(ctx, step.template, step.kind)],
    captions: emptyCaptions(),
    formats: [...step.formats],
    channels: [...step.channels],
    scheduledFor: planned!.at,
  });
  return row.id;
}

export async function saveEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  // Multi-value fields go back as comma lists so the form can restore them.
  values.speakers = fd.getAll("speakers").join(",");
  values.partners = fd.getAll("partners").join(",");
  values.plan = fd.getAll("plan").join(",");
  let target: string;
  try {
    const user = await requirePermission("event.edit");
    const parsed = readEvent(fd);
    if (!parsed.success) return { errors: fieldErrors(parsed.error), values, message: "Check the highlighted fields." };
    const v = parsed.data;
    const linkErrors = await checkLinks(v);
    if (Object.keys(linkErrors).length) return { errors: linkErrors, values, message: "Check the highlighted fields." };

    const data = {
      title: v.title,
      preset: v.preset,
      seriesLabel: v.seriesLabel,
      summary: v.summary,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      roomId: v.roomId,
      place: v.place,
      rsvpUrl: v.rsvpUrl,
    };

    if (v.id) {
      const [before] = await db().select({ startsAt: schema.events.startsAt }).from(schema.events).where(eq(schema.events.id, v.id)).limit(1);
      if (!before) return { message: "That event no longer exists. Someone may have deleted it.", values };
      await db().transaction(async (tx) => {
        await tx.update(schema.events).set({ ...data, updatedAt: new Date() }).where(eq(schema.events.id, v.id!));
        await tx.delete(schema.eventSpeakers).where(eq(schema.eventSpeakers.eventId, v.id!));
        await tx.delete(schema.eventPartners).where(eq(schema.eventPartners.eventId, v.id!));
        if (v.speakers.length) await tx.insert(schema.eventSpeakers).values(v.speakers.map((speakerId, sort) => ({ eventId: v.id!, speakerId, sort })));
        if (v.partners.length) await tx.insert(schema.eventPartners).values(v.partners.map((partnerId, sort) => ({ eventId: v.id!, partnerId, sort })));
      });
      let moved = 0;
      const shift = dayDiff(before.startsAt, v.startsAt);
      if (v.movePosts && shift !== 0) moved = await movePlanPosts(user, v.id, shift);
      target = `/events/${v.id}${moved ? `?moved=${moved}` : ""}`;
    } else {
      const id = await db().transaction(async (tx) => {
        const [row] = await tx.insert(schema.events).values({ ...data, createdBy: user.id }).returning({ id: schema.events.id });
        if (v.speakers.length) await tx.insert(schema.eventSpeakers).values(v.speakers.map((speakerId, sort) => ({ eventId: row!.id, speakerId, sort })));
        if (v.partners.length) await tx.insert(schema.eventPartners).values(v.partners.map((partnerId, sort) => ({ eventId: row!.id, partnerId, sort })));
        return row!.id;
      });
      const kinds = EVENT_PLAN.map((s) => s.kind).filter((k) => v.plan.includes(k));
      for (const kind of kinds) await createStepPost(user, id, kind);
      target = `/events/${id}?created=${kinds.length}`;
    }
  } catch (err) {
    if (isNextControlFlow(err)) throw err;
    return { ...failure(err, "saveEvent"), values };
  }
  redirect(target as Route);
}

/** Whole Wichita calendar days from one instant's day to another's. */
function dayDiff(a: Date, b: Date): number {
  const x = parseDayKey(dayKey(a));
  const y = parseDayKey(dayKey(b));
  return Math.round((Date.UTC(y.year, y.month - 1, y.day) - Date.UTC(x.year, x.month - 1, x.day)) / 86_400_000);
}

/** Moves an event's unposted, scheduled posts by whole days, keeping their Wichita time of day. */
async function movePlanPosts(user: User, eventId: string, days: number): Promise<number> {
  const rows = await db()
    .select({ id: schema.posts.id, version: schema.posts.version, scheduledFor: schema.posts.scheduledFor, status: schema.posts.status })
    .from(schema.posts)
    .where(eq(schema.posts.eventId, eventId));
  let n = 0;
  for (const r of rows) {
    if (!r.scheduledFor || r.status === "posted") continue;
    const z = zoned(r.scheduledFor);
    const key = addDays(dayKey(r.scheduledFor), days);
    const d = parseDayKey(key);
    await saveContent(user, r.id, r.version, { scheduledFor: fromZoned(d.year, d.month, d.day, z.hour, z.minute) });
    n++;
  }
  return n;
}

/* ---------------- event page actions ---------------- */

const IdOnly = z.object({ eventId: UUID });

async function eventOr404(id: string) {
  const [ev] = await db().select().from(schema.events).where(eq(schema.events.id, id)).limit(1);
  if (!ev) throw new UserError("That event no longer exists. Someone may have deleted it.");
  return ev;
}

/** Creates the post for one missing plan step. */
export async function addPlanStep(_prev: FormState, fd: FormData): Promise<FormState> {
  let id: string;
  try {
    const user = await requirePermission("post.edit");
    const parsed = z.object({ eventId: UUID, kind: z.enum(STEP_KINDS) }).safeParse({ eventId: fd.get("eventId"), kind: fd.get("kind") });
    if (!parsed.success) return { message: "That plan step didn't make sense. Reload the page and try again." };
    const ev = await eventOr404(parsed.data.eventId);
    if (ev.status === "cancelled") return { message: "This event is cancelled. Restore it before adding posts." };
    id = await createStepPost(user, ev.id, parsed.data.kind);
  } catch (err) {
    return failure(err, "addPlanStep");
  }
  redirect(`/posts/${id}` as Route);
}

export async function setEventCancelled(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await requirePermission("event.edit");
    const parsed = IdOnly.extend({ cancelled: z.enum(["1", "0"]) }).safeParse({ eventId: fd.get("eventId"), cancelled: fd.get("cancelled") });
    if (!parsed.success) return { message: "Reload the page and try again." };
    await eventOr404(parsed.data.eventId);
    await db()
      .update(schema.events)
      .set({ status: parsed.data.cancelled === "1" ? "cancelled" : "planned", updatedAt: new Date() })
      .where(eq(schema.events.id, parsed.data.eventId));
  } catch (err) {
    return failure(err, "setEventCancelled");
  }
  refresh();
  return { ok: true };
}

export async function deleteEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("event.delete");
    const parsed = IdOnly.safeParse({ eventId: fd.get("eventId") });
    if (!parsed.success) return { message: "Reload the page and try again." };
    const ev = await eventOr404(parsed.data.eventId);
    const posts = await db().select({ id: schema.posts.id, status: schema.posts.status }).from(schema.posts).where(eq(schema.posts.eventId, ev.id));
    if (posts.some((x) => x.status === "posted")) {
      return { message: "Some of this event's posts are already published, so it stays on record. Cancel it instead." };
    }
    for (const x of posts) await deletePost(user, x.id);
    await db().delete(schema.events).where(eq(schema.events.id, ev.id));
  } catch (err) {
    return failure(err, "deleteEvent");
  }
  redirect("/events?deleted=1" as Route);
}

const count = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    if (!/^\d{1,6}$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "Use a whole number, or leave it empty." });
      return null;
    }
    return Number(v);
  });

export async function saveResults(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  try {
    await requirePermission("results.edit");
    const parsed = z
      .object({ eventId: UUID, rsvps: count, attendance: count, resultsNote: z.string().trim().max(500, "Keep the note under 500 characters.") })
      .safeParse({ eventId: fd.get("eventId"), rsvps: fd.get("rsvps") ?? "", attendance: fd.get("attendance") ?? "", resultsNote: fd.get("resultsNote") ?? "" });
    if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
    const ev = await eventOr404(parsed.data.eventId);
    if (ev.startsAt.getTime() > Date.now()) return { message: "Results go in once the event has started.", values };
    const { rsvps, attendance, resultsNote } = parsed.data;
    await db().update(schema.events).set({ rsvps, attendance, resultsNote, updatedAt: new Date() }).where(eq(schema.events.id, ev.id));
  } catch (err) {
    return { ...failure(err, "saveResults"), values };
  }
  refresh();
  return { ok: true, message: "Results saved. A recap made from now on uses them.", values };
}
