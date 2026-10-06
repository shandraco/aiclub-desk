"use server";

import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, formValues, type FormState } from "@/lib/actions";
import { isLocked, recordAttempt } from "@/lib/auth/rate-limit";
import { ARGON2_OPTIONS, passwordProblem, usernameProblem } from "@/lib/auth/rules";
import { createSession, destroySession, getUser, hashToken } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { log } from "@/lib/log";

// Verified against when the username does not exist, so a miss costs the same time as a hit.
let dummyHash: Promise<string> | null = null;
const dummy = () => (dummyHash ??= hash("not-a-real-password-for-timing", ARGON2_OPTIONS));

/** Only same-site paths: "/events/x" yes; "//evil.com" and "https://..." no. */
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return /^\/(?!\/)[\w\-./?=&%]*$/.test(s) ? s : "/";
}

const SignIn = z.object({
  username: z.string().trim().toLowerCase().min(1, "Enter your username or email.").max(120, "That username is too long."),
  password: z.string().min(1, "Enter your password.").max(128, "That password is too long."),
});

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = SignIn.safeParse({ username: fd.get("username"), password: fd.get("password") });
  const values = formValues(fd);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const { username, password } = parsed.data;

  if (await isLocked(username)) {
    return { message: "Too many attempts. Wait 15 minutes, or ask an admin to reset your password.", values };
  }
  const [user] = await db()
    .select({ id: schema.users.id, passwordHash: schema.users.passwordHash, disabledAt: schema.users.disabledAt })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);
  const ok = user ? await verify(user.passwordHash, password) : (await verify(await dummy(), password), false);
  await recordAttempt(username, ok && !user?.disabledAt);
  if (!user || !ok) return { message: "That username and password don’t match. Check both and try again.", values };
  if (user.disabledAt) return { message: "This account is turned off. Ask an admin if that’s a mistake.", values };

  await createSession(user.id);
  log.info("signed in", { actor: user.id });
  redirect(safeNext(fd.get("next")) as never);
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

const Join = z
  .object({
    token: z.string().min(20).max(100),
    displayName: z.string().trim().min(1, "Enter your name as teammates know it.").max(60, "Use 60 characters or fewer."),
    username: z.string().trim().toLowerCase(),
    password: z.string(),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const u = usernameProblem(v.username);
    if (u) ctx.addIssue({ code: "custom", path: ["username"], message: u });
    const p = passwordProblem(v.password, v.username || " ");
    if (p) ctx.addIssue({ code: "custom", path: ["password"], message: p });
    else if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "The two passwords differ. Type it again." });
  });

export async function acceptInvite(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd, ["password", "confirm", "token"]);
  const parsed = Join.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const { token, displayName, username, password } = parsed.data;
  if (await getUser()) return { message: "You’re already signed in. Sign out first to use this invite.", values };

  const passwordHash = await hash(password, ARGON2_OPTIONS);
  type Outcome = { kind: "gone" } | { kind: "taken" } | { kind: "ok"; userId: string };
  const result = await db().transaction(async (tx): Promise<Outcome> => {
    // Lock the invite row so two people opening the same link can't both use it.
    const [invite] = await tx
      .select()
      .from(schema.invites)
      .where(
        and(
          eq(schema.invites.tokenHash, hashToken(token)),
          isNull(schema.invites.usedAt),
          isNull(schema.invites.revokedAt),
          gt(schema.invites.expiresAt, new Date()),
        ),
      )
      .for("update")
      .limit(1);
    if (!invite) return { kind: "gone" };
    const [taken] = await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, username)).limit(1);
    if (taken) return { kind: "taken" };
    const [user] = await tx
      .insert(schema.users)
      .values({ username, displayName, passwordHash, role: invite.role })
      .returning({ id: schema.users.id });
    await tx.update(schema.invites).set({ usedAt: new Date(), usedBy: user!.id }).where(eq(schema.invites.id, invite.id));
    return { kind: "ok", userId: user!.id };
  });
  if (result.kind === "gone") return { message: "This invite link has been used, has expired or was cancelled. Ask an admin for a new one.", values };
  if (result.kind === "taken") return { errors: { username: "That username is taken. Try another." }, values };

  await createSession(result.userId);
  log.info("invite accepted", { actor: result.userId });
  redirect("/?welcome=1");
}
