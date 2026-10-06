"use server";

import { hash, verify } from "@node-rs/argon2";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { failure, fieldErrors, formValues, type FormState } from "@/lib/actions";
import { isLocked, recordAttempt } from "@/lib/auth/rate-limit";
import { ARGON2_OPTIONS, passwordProblem } from "@/lib/auth/rules";
import { hashToken, requireUser, SESSION_COOKIE } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { log } from "@/lib/log";

/** The hashed id of this browser's session, so "sign out other sessions" can keep it. */
async function currentSessionId(): Promise<string> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  return hashToken(token);
}

async function endOtherSessions(userId: string) {
  await db()
    .delete(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, await currentSessionId())));
}

const Name = z.object({
  displayName: z.string().trim().min(1, "Enter your name as teammates know it.").max(60, "Use 60 characters or fewer."),
});

export async function updateName(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  try {
    const me = await requireUser();
    const parsed = Name.safeParse({ displayName: fd.get("displayName") });
    if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
    await db().update(schema.users).set({ displayName: parsed.data.displayName }).where(eq(schema.users.id, me.id));
    refresh();
    return { ok: true, message: "Name saved.", values };
  } catch (err) {
    return { ...failure(err, "updateName"), values };
  }
}

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await requireUser();
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    const errors: Record<string, string> = {};
    if (!current) errors.current = "Enter your current password.";
    else if (current.length > 128) errors.current = "That password is too long.";
    const p = passwordProblem(next, me.username);
    if (p) errors.password = p;
    else if (next !== confirm) errors.confirm = "The two new passwords differ. Type it again.";
    else if (next === current) errors.password = "Pick a password different from your current one.";
    if (Object.keys(errors).length) return { errors };

    // Wrong current passwords count as failed sign-ins for this username, so a borrowed
    // unlocked laptop can't be used to guess the password.
    if (await isLocked(me.username)) {
      return { message: "Too many wrong passwords. Wait 15 minutes, or ask an admin to reset your password." };
    }
    const [row] = await db().select({ passwordHash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, me.id)).limit(1);
    const ok = !!row && (await verify(row.passwordHash, current));
    if (!ok) {
      await recordAttempt(me.username, false);
      return { errors: { current: "That isn’t your current password. Check it and try again." } };
    }
    const passwordHash = await hash(next, ARGON2_OPTIONS);
    await db().update(schema.users).set({ passwordHash }).where(eq(schema.users.id, me.id));
    await endOtherSessions(me.id);
    log.info("password changed", { actor: me.id });
    refresh();
    return { ok: true, message: "Password changed. You’re still signed in here; every other device has been signed out." };
  } catch (err) {
    return failure(err, "changePassword");
  }
}

export async function signOutOthers(_prev: FormState, _fd: FormData): Promise<FormState> {
  try {
    const me = await requireUser();
    await endOtherSessions(me.id);
    log.info("signed out other sessions", { actor: me.id });
    refresh();
    return { ok: true, message: "Signed out everywhere else." };
  } catch (err) {
    return failure(err, "signOutOthers");
  }
}
