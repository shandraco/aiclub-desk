"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessage, TextField } from "@/components/forms/Field";
import type { FormState } from "@/lib/actions";
import { changePassword, signOutOthers, updateName } from "./actions";
import styles from "./account.module.css";

function Done({ state }: { state: FormState }) {
  return (
    <div role="status" aria-live="polite">
      {state.ok && state.message ? <p className="notice">{state.message}</p> : null}
    </div>
  );
}

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateName, {});
  const value = state.values?.displayName ?? name;
  return (
    <form action={action} noValidate className={styles.form}>
      <TextField key={value} label="Display name" name="displayName" defaultValue={value} hint="Shown to teammates on posts, reviews and comments." error={state.errors?.displayName} autoComplete="name" maxLength={60} />
      {!state.ok ? <FormMessage message={state.message} /> : <Done state={state} />}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save name"}</button>
      </div>
    </form>
  );
}

export function PasswordForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} noValidate className={styles.form}>
      {/* Lets password managers file the new password under the right account. */}
      <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />
      <TextField label="Current password" name="current" type="password" autoComplete="current-password" required error={state.errors?.current} />
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required hint="At least 10 characters. A short sentence works well." error={state.errors?.password} />
      <TextField label="New password again" name="confirm" type="password" autoComplete="new-password" required error={state.errors?.confirm} />
      {!state.ok ? <FormMessage message={state.message} /> : <Done state={state} />}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Changing…" : "Change password"}</button>
      </div>
    </form>
  );
}

export function SignOutOthers({ others }: { others: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signOutOthers, {});
  return (
    <form action={action} className={styles.inline}>
      <button type="submit" className="btn" disabled={pending || others === 0}>{pending ? "Signing out…" : "Sign out other sessions"}</button>
      {!state.ok ? <FormMessage message={state.message} /> : <Done state={state} />}
    </form>
  );
}
