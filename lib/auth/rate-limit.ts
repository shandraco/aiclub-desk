import "server-only";
import { and, count, eq, gt, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "@/lib/db";

/**
 * Failed sign-ins per username and per client address, in Postgres (no extra service).
 * 5 failures for one username in 15 minutes locks that username for the rest of the window;
 * 30 failures from one address does the same for the address. Successes are recorded too,
 * for the audit trail, and do not reset the count: a lockout ends when its window passes.
 */
const WINDOW_MS = 15 * 60_000;
const LIMITS = { user: 5, ip: 30 };

export async function clientKey(): Promise<string> {
  const h = await headers();
  // Vercel sets x-forwarded-for with the client first; locally there is none.
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `ip:${ip}`;
}

async function failures(key: string): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [row] = await db()
    .select({ n: count() })
    .from(schema.authAttempts)
    .where(and(eq(schema.authAttempts.key, key), eq(schema.authAttempts.ok, false), gt(schema.authAttempts.at, since)));
  return row?.n ?? 0;
}

export async function isLocked(username: string): Promise<boolean> {
  const [u, ip] = await Promise.all([failures(`user:${username}`), failures(await clientKey())]);
  return u >= LIMITS.user || ip >= LIMITS.ip;
}

export async function recordAttempt(username: string, ok: boolean): Promise<void> {
  const ip = await clientKey();
  await db().insert(schema.authAttempts).values([
    { key: `user:${username}`, ok },
    { key: ip, ok },
  ]);
  // Keep the table small: drop anything older than a day, now and then.
  if (Math.random() < 0.05) {
    await db().delete(schema.authAttempts).where(lt(schema.authAttempts.at, new Date(Date.now() - 86_400_000)));
  }
}
