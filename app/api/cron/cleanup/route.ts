import { timingSafeEqual } from "node:crypto";
import { and, isNotNull, lt, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * Daily housekeeping, called by Vercel Cron (vercel.json) with `Authorization: Bearer
 * $CRON_SECRET`. Rejects everything when the secret is unset, so it can't be triggered by
 * anyone else.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const now = Date.now();
  const d = db();
  const sessions = await d.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date(now))).returning({ id: schema.sessions.id });
  const attempts = await d.delete(schema.authAttempts).where(lt(schema.authAttempts.at, new Date(now - 7 * 86_400_000))).returning({ id: schema.authAttempts.id });
  const presence = await d.delete(schema.presence).where(lt(schema.presence.seenAt, new Date(now - 86_400_000))).returning({ p: schema.presence.postId });
  const invites = await d
    .delete(schema.invites)
    .where(and(lt(schema.invites.expiresAt, new Date(now - 30 * 86_400_000)), or(isNotNull(schema.invites.usedAt), isNotNull(schema.invites.revokedAt), lt(schema.invites.expiresAt, new Date(now)))))
    .returning({ id: schema.invites.id });
  const counts = { sessions: sessions.length, attempts: attempts.length, presence: presence.length, invites: invites.length };
  log.info("cleanup done", counts);
  return Response.json(counts);
}
