"use client";

import { useActionState } from "react";
import { FormMessage, TextField } from "@/components/forms/Field";
import type { FormState } from "@/lib/actions";
import { acceptInvite } from "../../actions";
import styles from "../../auth.module.css";

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInvite, {});
  const v = state.values ?? {};
  return (
    <form action={action} noValidate>
      <input type="hidden" name="token" value={token} />
      <TextField label="Your name" name="displayName" autoComplete="name" hint="How teammates see you on reviews and comments." required defaultValue={v.displayName} error={state.errors?.displayName} />
      <TextField label="Username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} hint="Your email address, or a short handle like ada.l. You’ll sign in with this." required defaultValue={v.username} error={state.errors?.username} />
      <TextField label="Password" name="password" type="password" autoComplete="new-password" hint="At least 10 characters. A short sentence is easy to remember and hard to guess." required error={state.errors?.password} />
      <TextField label="Password again" name="confirm" type="password" autoComplete="new-password" required error={state.errors?.confirm} />
      <FormMessage message={state.message} />
      <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}
