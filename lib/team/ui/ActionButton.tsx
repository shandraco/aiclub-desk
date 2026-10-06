"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/lib/actions";
import styles from "./ui.module.css";

/**
 * One button that runs a server action with a few hidden fields (archive, revoke, enable),
 * and shows the action's message next to it if it fails.
 */
export function ActionButton({
  action,
  fields,
  children,
  pendingLabel,
  className = "btn btn-s",
  confirm,
  label,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  /** Asks before running, for actions that are hard to take back. */
  confirm?: string;
  /** Accessible name when the visible text alone is ambiguous in a list ("Archive Ada Lovelace"). */
  label?: string;
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={className} disabled={pending} aria-label={label}>
        {pending && pendingLabel ? pendingLabel : children}
      </button>
      <span role="status" aria-live="polite">
        {state.message && !state.ok ? <span className={styles.actionError}>{state.message}</span> : null}
      </span>
    </form>
  );
}
