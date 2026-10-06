import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { UserError } from "@/lib/actions";
import { can } from "@/lib/auth/rules";
import { ForbiddenError, type User } from "@/lib/auth/session";
import { checkPost } from "@/lib/brand/checks";
import { db, schema } from "@/lib/db";
import type { Captions, Slide } from "./types";

/**
 * Every change to a post's content or status goes through this file, whichever page or route
 * calls it.
 *
 * Rules:
 *  - Content saves carry the version the editor started from; a stale version is refused
 *    (someone else saved first) instead of silently overwriting their work.
 *  - Editing an approved post sends it back to review: the approval was for other words.
 *  - Posted posts are locked until someone reopens them.
 *  - Approval needs a second person: not the author, not the last editor, and an officer or
 *    admin. It is tied to the version the approver looked at, and to a clean brand check.
 *  - Each status change is one conditional UPDATE (status and version in the WHERE), so two
 *    people pressing buttons at once cannot both succeed.
 */

type PostRow = typeof schema.posts.$inferSelect;
type Status = PostRow["status"];

export class ConflictError extends UserError {
  override name = "ConflictError";
}

async function load(postId: string): Promise<PostRow> {
  const [p] = await db().select().from(schema.posts).where(eq(schema.posts.id, postId)).limit(1);
  if (!p) throw new UserError("That post no longer exists. Someone may have deleted it.");
  return p;
}

async function note(postId: string, actorId: string, action: (typeof schema.activityActionEnum.enumValues)[number], body = "") {
  await db().insert(schema.postActivity).values({ postId, actorId, action, body });
}

/** Applies a conditional update; throws ConflictError if the post moved on underneath us. */
async function guarded(postId: string, from: Status[], version: number | null, set: Partial<PostRow>): Promise<PostRow> {
  const where = [eq(schema.posts.id, postId), inArray(schema.posts.status, from)];
  if (version !== null) where.push(eq(schema.posts.version, version));
  const [row] = await db()
    .update(schema.posts)
    .set({ ...set, version: sql`${schema.posts.version} + 1`, updatedAt: new Date() })
    .where(and(...where))
    .returning();
  if (!row) throw new ConflictError("Someone changed this post a moment ago. The page has their version now; check it and try again.");
  return row;
}

export interface ContentPatch {
  slides?: Slide[];
  captions?: Captions;
  formats?: string[];
  channels?: string[];
  scheduledFor?: Date | null;
  kind?: PostRow["kind"];
}

/** Saves content. Returns the new row (with its new version) for the editor to continue from. */
export async function saveContent(user: User, postId: string, version: number, patch: ContentPatch): Promise<PostRow> {
  if (!can(user.role, "post.edit")) throw new ForbiddenError();
  const post = await load(postId);
  if (post.status === "posted") throw new UserError("This post is already published. Reopen it before changing it.");
  const backToReview = post.status === "approved";
  const row = await guarded(postId, ["draft", "in_review", "changes_requested", "approved"], version, {
    ...patch,
    updatedBy: user.id,
    ...(backToReview ? { status: "in_review" as const, approvedBy: null, approvedAt: null } : {}),
  });
  if (backToReview) await note(postId, user.id, "reopened", "Edited after approval, so it needs approving again.");
  return row;
}

export async function requestReview(user: User, postId: string, version: number, reviewerId: string | null, message: string): Promise<PostRow> {
  if (!can(user.role, "post.edit")) throw new ForbiddenError();
  if (reviewerId === user.id) throw new UserError("Ask someone else to review it. Approval needs a second person.");
  if (reviewerId) {
    const [r] = await db().select({ role: schema.users.role, disabledAt: schema.users.disabledAt }).from(schema.users).where(eq(schema.users.id, reviewerId)).limit(1);
    if (!r || r.disabledAt || !can(r.role, "post.approve")) throw new UserError("That person can’t approve posts. Pick an officer or admin.");
  }
  const row = await guarded(postId, ["draft", "changes_requested"], version, { status: "in_review", reviewerId });
  await note(postId, user.id, "review_requested", message.trim());
  return row;
}

export interface Checklist {
  facts: boolean;
  tagged: boolean;
  consent: boolean;
}

export async function approve(user: User, postId: string, version: number, checklist: Checklist, message: string): Promise<PostRow> {
  if (!can(user.role, "post.approve")) throw new ForbiddenError("Only officers and admins can approve posts.");
  const post = await load(postId);
  if (post.version !== version) throw new ConflictError("This post changed since you opened it. Look at the new version before approving.");
  if (post.authorId === user.id) throw new UserError("You wrote this post, so someone else has to approve it.");
  if (post.updatedBy === user.id) throw new UserError("You made the last edit, so someone else has to approve it.");
  const hasSpeakers = post.slides.some((s) => s.template === "speaker");
  if (!checklist.facts || !checklist.tagged || (hasSpeakers && !checklist.consent)) {
    throw new UserError("Tick every review box first. They’re what approval means.");
  }
  const errors = checkPost(post.slides, post.captions, post.channels).filter((i) => i.level === "error");
  if (errors.length) throw new UserError(`Fix the brand check first: ${errors[0]!.text}`);
  const row = await guarded(postId, ["in_review"], version, { status: "approved", approvedBy: user.id, approvedAt: new Date(), checklist });
  await note(postId, user.id, "approved", message.trim());
  return row;
}

export async function requestChanges(user: User, postId: string, version: number, message: string): Promise<PostRow> {
  if (!can(user.role, "post.approve")) throw new ForbiddenError("Only officers and admins review posts.");
  if (!message.trim()) throw new UserError("Say what needs to change, so the author knows what to fix.");
  const row = await guarded(postId, ["in_review"], version, { status: "changes_requested" });
  await note(postId, user.id, "changes_requested", message.trim());
  return row;
}

export async function markPosted(user: User, postId: string, version: number, urls: Record<string, string>): Promise<PostRow> {
  if (!can(user.role, "post.markPosted")) throw new ForbiddenError("Only officers and admins mark posts as published.");
  const clean = Object.fromEntries(Object.entries(urls).filter(([, v]) => /^https:\/\/\S+$/.test(v)));
  const row = await guarded(postId, ["approved"], version, { status: "posted", postedAt: new Date(), postedUrls: clean });
  await note(postId, user.id, "posted");
  return row;
}

export async function reopen(user: User, postId: string, version: number, reason: string): Promise<PostRow> {
  if (!can(user.role, "post.edit")) throw new ForbiddenError();
  const post = await load(postId);
  if (post.status === "posted" && !can(user.role, "post.markPosted")) throw new ForbiddenError("Only officers and admins reopen published posts.");
  const row = await guarded(postId, ["in_review", "approved", "posted", "changes_requested"], version, {
    status: "draft",
    approvedBy: null,
    approvedAt: null,
    postedAt: null,
  });
  await note(postId, user.id, "reopened", reason.trim());
  return row;
}

export async function comment(user: User, postId: string, body: string): Promise<void> {
  if (!can(user.role, "post.edit")) throw new ForbiddenError();
  const text = body.trim();
  if (!text) throw new UserError("Write a comment first.");
  if (text.length > 2000) throw new UserError("Keep comments under 2,000 characters.");
  await load(postId);
  await note(postId, user.id, "comment", text);
}

export async function createPost(
  user: User,
  values: { eventId: string | null; kind: PostRow["kind"]; preset: string; slides: Slide[]; captions: Captions; formats: string[]; channels: string[]; scheduledFor: Date | null },
): Promise<PostRow> {
  if (!can(user.role, "post.edit")) throw new ForbiddenError();
  const [row] = await db()
    .insert(schema.posts)
    .values({ ...values, authorId: user.id, updatedBy: user.id })
    .returning();
  await note(row!.id, user.id, "created");
  return row!;
}

export async function deletePost(user: User, postId: string): Promise<void> {
  const post = await load(postId);
  if (!can(user.role, "post.delete") && post.authorId !== user.id) throw new ForbiddenError("Only the author, an officer or an admin can delete a post.");
  if (post.status === "posted") throw new UserError("Published posts stay on record. Reopen it first if it was never really posted.");
  await db().delete(schema.posts).where(eq(schema.posts.id, postId));
}
