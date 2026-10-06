"use server";

import { and, eq, gt, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, isNextControlFlow } from "@/lib/actions";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { newSlideId, renumber } from "@/lib/posts/factory";
import * as workflow from "@/lib/posts/workflow";
import { SaveSchema, type SaveInput } from "../schema";

/**
 * The editor's server actions. Each checks the session itself, validates its input with zod,
 * and changes a post only through lib/posts/workflow.ts. Results are plain objects so the
 * client can show the message where the person is looking.
 */

export type Result = { ok: true; version?: number; status?: string } | { ok: false; message: string; conflict?: boolean };

const bad = (message = "That request didn’t look right. Reload the page and try again."): Result => ({ ok: false, message });

function fail(err: unknown, where: string): Result {
  if (isNextControlFlow(err)) throw err;
  return { ok: false, message: failure(err, where).message ?? "That didn’t work. Try again.", conflict: err instanceof workflow.ConflictError };
}

const Id = z.uuid();
const Version = z.number().int().min(1);
const Message = z.string().max(2000);

/* ---------------- content ---------------- */

export async function savePost(input: SaveInput): Promise<Result> {
  try {
    const user = await requirePermission("post.edit");
    const parsed = SaveSchema.safeParse(input);
    if (!parsed.success) return bad(`That change couldn’t be saved: ${parsed.error.issues[0]?.message ?? "invalid content"}.`);
    const { postId, version, patch } = parsed.data;
    const [before] = await db().select({ status: schema.posts.status }).from(schema.posts).where(eq(schema.posts.id, postId)).limit(1);
    const row = await workflow.saveContent(user, postId, version, {
      ...patch,
      scheduledFor: patch.scheduledFor ? new Date(patch.scheduledFor) : null,
    });
    // Only re-render the page when the status moved (an approved post went back to review).
    if (before && before.status !== row.status) refresh();
    return { ok: true, version: row.version, status: row.status };
  } catch (err) {
    return fail(err, "posts.save");
  }
}

/* ---------------- presence ---------------- */

export interface Here {
  id: string;
  name: string;
}

/** Marks me as having this post open, and returns who else has been here in the last minute. */
export async function heartbeat(postId: string): Promise<Here[]> {
  const user = await requireUser();
  if (!Id.safeParse(postId).success) return [];
  const d = db();
  const now = new Date();
  try {
    await d
      .insert(schema.presence)
      .values({ postId, userId: user.id, seenAt: now })
      .onConflictDoUpdate({ target: [schema.presence.postId, schema.presence.userId], set: { seenAt: now } });
  } catch {
    return []; // the post was deleted
  }
  return d
    .select({ id: schema.users.id, name: schema.users.displayName })
    .from(schema.presence)
    .innerJoin(schema.users, eq(schema.users.id, schema.presence.userId))
    .where(and(eq(schema.presence.postId, postId), ne(schema.presence.userId, user.id), gt(schema.presence.seenAt, new Date(now.getTime() - 60_000))));
}

export async function leave(postId: string): Promise<void> {
  const user = await requireUser();
  if (!Id.safeParse(postId).success) return;
  await db().delete(schema.presence).where(and(eq(schema.presence.postId, postId), eq(schema.presence.userId, user.id)));
}

/* ---------------- review workflow ---------------- */

const Ask = z.object({ postId: Id, version: Version, reviewerId: Id.nullable(), message: Message });
export async function askForReview(input: z.input<typeof Ask>): Promise<Result> {
  try {
    const user = await requirePermission("post.edit");
    const p = Ask.safeParse(input);
    if (!p.success) return bad();
    const row = await workflow.requestReview(user, p.data.postId, p.data.version, p.data.reviewerId, p.data.message);
    refresh();
    return { ok: true, version: row.version, status: row.status };
  } catch (err) {
    return fail(err, "posts.requestReview");
  }
}

const Approve = z.object({
  postId: Id,
  version: Version,
  checklist: z.object({ facts: z.boolean(), tagged: z.boolean(), consent: z.boolean() }),
  message: Message,
});
export async function approvePost(input: z.input<typeof Approve>): Promise<Result> {
  try {
    const user = await requirePermission("post.approve");
    const p = Approve.safeParse(input);
    if (!p.success) return bad();
    const row = await workflow.approve(user, p.data.postId, p.data.version, p.data.checklist, p.data.message);
    refresh();
    return { ok: true, version: row.version, status: row.status };
  } catch (err) {
    return fail(err, "posts.approve");
  }
}

const Changes = z.object({ postId: Id, version: Version, message: Message });
export async function askForChanges(input: z.input<typeof Changes>): Promise<Result> {
  try {
    const user = await requirePermission("post.approve");
    const p = Changes.safeParse(input);
    if (!p.success) return bad();
    const row = await workflow.requestChanges(user, p.data.postId, p.data.version, p.data.message);
    refresh();
    return { ok: true, version: row.version, status: row.status };
  } catch (err) {
    return fail(err, "posts.requestChanges");
  }
}

const Posted = z.object({ postId: Id, version: Version, urls: z.partialRecord(z.enum(["instagram", "linkedin", "story"]), z.string().max(500)) });
export async function markAsPosted(input: z.input<typeof Posted>): Promise<Result> {
  try {
    const user = await requirePermission("post.markPosted");
    const p = Posted.safeParse(input);
    if (!p.success) return bad();
    const urls: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.data.urls as Record<string, string | undefined>)) if (v?.trim()) urls[k] = v.trim();
    for (const v of Object.values(urls)) {
      if (!/^https:\/\/\S+$/.test(v)) return bad("Post links must start with https://. Copy them from the live post.");
    }
    const row = await workflow.markPosted(user, p.data.postId, p.data.version, urls);
    refresh();
    return { ok: true, version: row.version, status: row.status };
  } catch (err) {
    return fail(err, "posts.markPosted");
  }
}

const Reopen = z.object({ postId: Id, version: Version, reason: Message });
export async function reopenPost(input: z.input<typeof Reopen>): Promise<Result> {
  try {
    const user = await requirePermission("post.edit");
    const p = Reopen.safeParse(input);
    if (!p.success) return bad();
    const row = await workflow.reopen(user, p.data.postId, p.data.version, p.data.reason);
    refresh();
    return { ok: true, version: row.version, status: row.status };
  } catch (err) {
    return fail(err, "posts.reopen");
  }
}

const Comment = z.object({ postId: Id, body: Message });
export async function addComment(input: z.input<typeof Comment>): Promise<Result> {
  try {
    const user = await requirePermission("post.edit");
    const p = Comment.safeParse(input);
    if (!p.success) return bad("Keep comments under 2,000 characters.");
    await workflow.comment(user, p.data.postId, p.data.body);
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err, "posts.comment");
  }
}

/* ---------------- whole post ---------------- */

/** Copies the post as a new draft (same event, words and images; no schedule, no review). */
export async function duplicatePost(postId: string): Promise<Result> {
  let newId: string;
  try {
    const user = await requirePermission("post.edit");
    if (!Id.safeParse(postId).success) return bad();
    const [p] = await db().select().from(schema.posts).where(eq(schema.posts.id, postId)).limit(1);
    if (!p) return bad("That post no longer exists.");
    const row = await workflow.createPost(user, {
      eventId: p.eventId,
      kind: p.kind,
      preset: p.preset,
      slides: renumber(p.slides.map((s) => ({ ...structuredClone(s), id: newSlideId() }))),
      captions: p.captions,
      formats: p.formats,
      channels: p.channels,
      scheduledFor: null,
    });
    newId = row.id;
  } catch (err) {
    return fail(err, "posts.duplicate");
  }
  redirect(`/posts/${newId}`);
}

export async function deletePostAction(postId: string): Promise<Result> {
  try {
    const user = await requireUser();
    if (!Id.safeParse(postId).success) return bad();
    await workflow.deletePost(user, postId);
  } catch (err) {
    return fail(err, "posts.delete");
  }
  redirect("/posts");
}
