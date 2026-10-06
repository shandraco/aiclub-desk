import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import { can, type Permission, type Role } from "./rules";

/**
 * Sessions: a random 256-bit token in an httpOnly cookie; the database stores only its
 * SHA-256, so reading the sessions table does not let anyone sign in. 30 days, sliding.
 *
 * Every server action and route handler calls requireUser() / requirePermission() first.
 * proxy.ts only redirects signed-out browsers; it is not the gate
 *.
 */

export const SESSION_DAYS = 30;
const DAY = 86_400_000;

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-desk_session" : "desk_session";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
}

export class UnauthorizedError extends Error {
  override name = "UnauthorizedError";
  constructor() {
    super("Sign in to continue.");
  }
}

export class ForbiddenError extends Error {
  override name = "ForbiddenError";
  constructor(message = "Your role can't do that. Ask an admin.") {
    super(message);
  }
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await db()
    .insert(schema.sessions)
    .values({ id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_DAYS * DAY), userAgent: ua });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db().delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user for this request, or null. Cached per request. */
export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const id = hashToken(token);
  const now = new Date();
  const rows = await db()
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      role: schema.users.role,
      lastUsedAt: schema.sessions.lastUsedAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, now), isNull(schema.users.disabledAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Slide the expiry at most once an hour, so reads stay reads.
  if (now.getTime() - row.lastUsedAt.getTime() > 3_600_000) {
    await db()
      .update(schema.sessions)
      .set({ lastUsedAt: now, expiresAt: new Date(now.getTime() + SESSION_DAYS * DAY) })
      .where(eq(schema.sessions.id, id));
    await db().update(schema.users).set({ lastSeenAt: now }).where(eq(schema.users.id, row.id));
  }
  return { id: row.id, username: row.username, displayName: row.displayName, role: row.role };
});

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requirePermission(permission: Permission): Promise<User> {
  const user = await requireUser();
  if (!can(user.role, permission)) throw new ForbiddenError();
  return user;
}

/** Signs a user out everywhere: after a password change, a role change or disabling. */
export async function endAllSessions(userId: string): Promise<void> {
  await db().delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export async function pruneExpiredSessions(): Promise<void> {
  await db().delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
}
