"use server";

import { hash } from "@node-rs/argon2";
import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { failure, fieldErrors, formValues, UserError, type FormState } from "@/lib/actions";
import { ARGON2_OPTIONS, ROLE_LABEL } from "@/lib/auth/rules";
import { endAllSessions, hashToken, newToken, requirePermission } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { log } from "@/lib/log";
import { absoluteUrl } from "@/lib/site";
import { tempPassword } from "@/lib/team/password";

/*
 * Team management. Admin only: every action re-checks team.manage itself. Secrets (the
 * temporary password, the invite link) go back to the admin's browser once, in the action's
 * response, and are never stored in plain form or logged.
 */

/** FormState plus a one-time secret for the admin to copy. */
export interface SecretState extends FormState {
  secret?: string;
}

const RoleEnum = z.enum(["admin", "officer", "member"], "Pick a role.");
const DAY = 86_400_000;
const INVITE_DAYS = 7;

async function target(id: unknown) {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new UserError("That request was malformed. Reload the page and try again.");
  const [u] = await db()
    .select({ id: schema.users.id, displayName: schema.users.displayName, username: schema.users.username, role: schema.users.role, disabledAt: schema.users.disabledAt })
    .from(schema.users)
    .where(eq(schema.users.id, parsed.data))
    .limit(1);
  if (!u) throw new UserError("That account no longer exists. Reload the page.");
  return u;
}

export async function changeRole(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await requirePermission("team.manage");
    const u = await target(fd.get("userId"));
    const role = RoleEnum.safeParse(fd.get("role"));
    if (!role.success) return { message: "Pick a role." };
    if (role.data === u.role) return { ok: true, message: `${u.displayName} is already ${ROLE_LABEL[u.role].toLowerCase()}.` };

    await db().transaction(async (tx) => {
      // Lock the active admins so two admins demoting each other at once can't leave none.
      const admins = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(eq(schema.users.role, "admin"), isNull(schema.users.disabledAt)))
        .for("update");
      const isActiveAdmin = admins.some((a) => a.id === u.id);
      if (isActiveAdmin && role.data !== "admin" && admins.length <= 1) {
        throw new UserError(
          u.id === me.id
            ? "You’re the only active admin. Make someone else an admin first, so the desk always has one."
            : `${u.displayName} is the only active admin. Make someone else an admin first.`,
        );
      }
      await tx.update(schema.users).set({ role: role.data }).where(eq(schema.users.id, u.id));
    });
    await endAllSessions(u.id);
    log.info("role changed", { actor: me.id, user: u.id, role: role.data });
    refresh();
    return { ok: true, message: `${u.displayName} is now ${ROLE_LABEL[role.data].toLowerCase()}. They’ve been signed out and sign in again with the new role.` };
  } catch (err) {
    return failure(err, "changeRole");
  }
}

export async function setDisabled(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await requirePermission("team.manage");
    const u = await target(fd.get("userId"));
    const disable = fd.get("disable") === "1";
    if (disable && u.id === me.id) throw new UserError("You can’t turn off your own account. Ask another admin.");
    if (disable) {
      await db().transaction(async (tx) => {
        const admins = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(and(eq(schema.users.role, "admin"), isNull(schema.users.disabledAt)))
          .for("update");
        if (admins.some((a) => a.id === u.id) && admins.length <= 1) throw new UserError(`${u.displayName} is the only active admin.`);
        await tx.update(schema.users).set({ disabledAt: new Date() }).where(eq(schema.users.id, u.id));
      });
      await endAllSessions(u.id);
    } else {
      await db().update(schema.users).set({ disabledAt: null }).where(eq(schema.users.id, u.id));
    }
    log.info(disable ? "user disabled" : "user enabled", { actor: me.id, user: u.id });
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err, "setDisabled");
  }
}

export async function resetPassword(_prev: SecretState, fd: FormData): Promise<SecretState> {
  try {
    const me = await requirePermission("team.manage");
    const u = await target(fd.get("userId"));
    if (u.id === me.id) throw new UserError("Change your own password on your account page; it asks for your current one.");
    const secret = tempPassword(u.username);
    const passwordHash = await hash(secret, ARGON2_OPTIONS);
    await db().update(schema.users).set({ passwordHash }).where(eq(schema.users.id, u.id));
    await endAllSessions(u.id);
    log.info("password reset by admin", { actor: me.id, user: u.id });
    refresh();
    return { ok: true, secret };
  } catch (err) {
    return failure(err, "resetPassword");
  }
}

const Invite = z.object({
  label: z.string().trim().min(1, "Say who it’s for, so you can tell invites apart.").max(60, "Use 60 characters or fewer."),
  role: RoleEnum,
});

export async function createInvite(_prev: SecretState, fd: FormData): Promise<SecretState> {
  const values = formValues(fd);
  try {
    const me = await requirePermission("team.manage");
    const parsed = Invite.safeParse({ label: fd.get("label"), role: fd.get("role") });
    if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
    const token = newToken();
    await db()
      .insert(schema.invites)
      .values({ tokenHash: hashToken(token), role: parsed.data.role, label: parsed.data.label, createdBy: me.id, expiresAt: new Date(Date.now() + INVITE_DAYS * DAY) });
    log.info("invite created", { actor: me.id, role: parsed.data.role });
    refresh();
    return { ok: true, secret: absoluteUrl(`/join/${token}`), values };
  } catch (err) {
    return { ...failure(err, "createInvite"), values };
  }
}

export async function revokeInvite(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await requirePermission("team.manage");
    const id = z.uuid().safeParse(fd.get("inviteId"));
    if (!id.success) return { message: "That request was malformed. Reload the page and try again." };
    const done = await db()
      .update(schema.invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.invites.id, id.data), isNull(schema.invites.usedAt), isNull(schema.invites.revokedAt)))
      .returning({ id: schema.invites.id });
    if (!done.length) throw new UserError("That invite was already used or cancelled.");
    log.info("invite revoked", { actor: me.id, invite: id.data });
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err, "revokeInvite");
  }
}
