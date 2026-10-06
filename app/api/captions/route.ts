import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiRoute, json } from "@/lib/api";
import { can } from "@/lib/auth/rules";
import { checkCaptions } from "@/lib/brand/checks";
import { loadEventContext } from "@/lib/data/events";
import { db, schema } from "@/lib/db";
import { draftFromTemplate } from "@/lib/posts/captions";
import { problemResponse } from "@/lib/problem";

const Body = z.object({ postId: z.uuid() });

/**
 * POST { postId } -> { captions, issues }. Fills caption starting points from the saved post
 * and its event (date, time, room, speakers). Plain templates only: no AI, no outside service.
 * The editor saves first, so the draft reflects what is on screen.
 */
export const POST = apiRoute("/api/captions", async ({ user, requestId }, request) => {
  if (!can(user.role, "post.edit")) return problemResponse("forbidden", requestId);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problemResponse("badRequest", requestId);
  const [post] = await db().select().from(schema.posts).where(eq(schema.posts.id, parsed.data.postId)).limit(1);
  if (!post) return problemResponse("notFound", requestId);
  const event = post.eventId ? await loadEventContext(post.eventId) : null;
  const captions = draftFromTemplate({ kind: post.kind, channels: post.channels, slides: post.slides, event });
  return json({ captions, issues: checkCaptions(captions, post.channels) });
});
