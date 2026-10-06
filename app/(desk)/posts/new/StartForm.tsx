"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/forms/Field";
import { startPost } from "./actions";

/** One form around every starting point; each choice is its own submit button. */
export function StartForm({ eventId, children }: { eventId?: string; children: ReactNode }) {
  const [state, action] = useActionState(startPost, {});
  return (
    <form action={action}>
      {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}
      <FormMessage message={state.message} />
      {children}
    </form>
  );
}

export function StartButton({ name, value, label }: { name: string; value: string; label: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get(name) === value;
  return (
    <button type="submit" name={name} value={value} className="btn" disabled={pending} aria-label={label}>
      {mine ? "Starting…" : "Start"}
    </button>
  );
}
