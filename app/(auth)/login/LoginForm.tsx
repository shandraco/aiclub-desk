"use client";

import { useActionState } from "react";
import { FormMessage, TextField } from "@/components/forms/Field";
import type { FormState } from "@/lib/actions";
import { signIn } from "../actions";
import styles from "../auth.module.css";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} noValidate>
      <input type="hidden" name="next" value={next} />
      <TextField label="Username or email" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required defaultValue={state.values?.username} error={state.errors?.username} />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required error={state.errors?.password} />
      <FormMessage message={state.message} />
      <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
