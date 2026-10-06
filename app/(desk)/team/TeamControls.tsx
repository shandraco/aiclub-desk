"use client";

import { startTransition, useActionState, useState } from "react";
import { FormMessage, TextField } from "@/components/forms/Field";
import type { FormState } from "@/lib/actions";
import type { Role } from "@/lib/auth/rules";
import { CopyField } from "@/lib/team/ui/CopyField";
import { Dialog } from "@/lib/team/ui/Dialog";
import { changeRole, createInvite, resetPassword, type SecretState } from "./actions";
import styles from "./team.module.css";

const ROLES: Role[] = ["admin", "officer", "member"];
const LABEL: Record<Role, string> = { admin: "Admin", officer: "Officer", member: "Member" };

export function RoleForm({ userId, name, role, self }: { userId: string; name: string; role: Role; self: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changeRole, {});
  const [value, setValue] = useState<Role>(role);
  // When the saved role changes (after the action and refresh), follow it.
  const [saved, setSaved] = useState<Role>(role);
  if (saved !== role) {
    setSaved(role);
    setValue(role);
  }
  const id = `role-${userId}`;
  return (
    <form
      className={styles.roleForm}
      onSubmit={(e) => {
        // Run the action by hand: a form `action` resets the form afterwards, which puts the
        // select back on the role it was first rendered with.
        e.preventDefault();
        if (self && value !== "admin" && !window.confirm("You’ll lose admin rights and be signed out. Continue?")) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <label htmlFor={id} className="visually-hidden">Role for {name}</label>
      <select id={id} name="role" className={`input ${styles.select}`} value={value} onChange={(e) => setValue(e.target.value as Role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>{LABEL[r]}</option>
        ))}
      </select>
      {value !== role ? (
        <button type="submit" className="btn btn-s btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Change"}
        </button>
      ) : null}
      <span role="status" aria-live="polite" className={state.ok ? styles.ok : styles.err}>
        {state.message ?? null}
      </span>
    </form>
  );
}

export function ResetPasswordButton({ userId, name, username }: { userId: string; name: string; username: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-s btn-quiet" onClick={() => setOpen(true)} aria-label={`Reset password for ${name}`}>
        Reset password
      </button>
      {open ? (
        <Dialog title={`Reset ${name}’s password`} onClose={() => setOpen(false)}>
          <ResetForm userId={userId} name={name} username={username} onDone={() => setOpen(false)} />
        </Dialog>
      ) : null}
    </>
  );
}

function ResetForm({ userId, name, username, onDone }: { userId: string; name: string; username: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<SecretState, FormData>(resetPassword, {});
  if (state.ok && state.secret) {
    return (
      <div className={styles.secret}>
        <CopyField label={`Temporary password for @${username}`} value={state.secret} hint="Send it to them directly, not in a group chat." />
        <p className="notice">
          This is the only time it’s shown. {name} has been signed out everywhere; they sign in with this and should change it on their account page straight away.
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={onDone}>Done</button>
        </div>
      </div>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <p className={styles.measure}>
        This makes a new temporary password for {name} and signs them out on every device. Their old password stops working at once.
      </p>
      <FormMessage message={state.message} />
      <div className={`btn-row ${styles.foot}`}>
        <button type="submit" className="btn btn-danger" disabled={pending} data-autofocus>{pending ? "Resetting…" : "Reset password"}</button>
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function InviteForm({ help }: { help: Record<Role, string> }) {
  const [round, setRound] = useState(0);
  return <InviteFormInner key={round} help={help} again={() => setRound((n) => n + 1)} />;
}

function InviteFormInner({ help, again }: { help: Record<Role, string>; again: () => void }) {
  const [state, action, pending] = useActionState<SecretState, FormData>(createInvite, {});
  if (state.ok && state.secret) {
    return (
      <div className={styles.secret}>
        <CopyField label={`Invite link for ${state.values?.label ?? "them"}`} value={state.secret} hint="Send it to them directly. It works once and expires in 7 days." />
        <p className="notice">This link won’t be shown again. If it gets lost, cancel it in the list of open invites and make a new one.</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={again}>Invite someone else</button>
        </div>
      </div>
    );
  }
  const role = (state.values?.role as Role | undefined) ?? "officer";
  return (
    <form action={action} noValidate className={styles.invite}>
      <TextField label="Who it’s for" name="label" hint="Only admins see this: “Maya, new events officer”." defaultValue={state.values?.label} error={state.errors?.label} autoComplete="off" maxLength={60} />
      <fieldset className={styles.roles}>
        <legend className="label">Role</legend>
        {ROLES.map((r) => (
          <div key={r} className="check">
            <input id={`invite-role-${r}`} type="radio" name="role" value={r} defaultChecked={r === role} />
            <label htmlFor={`invite-role-${r}`}>
              <b>{LABEL[r]}</b> <span className="muted">{help[r]}</span>
            </label>
          </div>
        ))}
        {state.errors?.role ? <span className="error">{state.errors.role}</span> : null}
      </fieldset>
      <FormMessage message={state.message} />
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create invite link"}</button>
      </div>
    </form>
  );
}
