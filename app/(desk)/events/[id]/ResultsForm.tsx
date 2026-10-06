"use client";

import { useActionState } from "react";
import { FormMessage, TextArea, TextField } from "@/components/forms/Field";
import type { FormState } from "@/lib/actions";
import { saveResults } from "../actions";
import s from "./event.module.css";

export function ResultsForm({ eventId, rsvps, attendance, note }: { eventId: string; rsvps: number | null; attendance: number | null; note: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveResults, {});
  const v = state.values;
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className={s.results}>
      <input type="hidden" name="eventId" value={eventId} />
      <div className={s.resultNums}>
        <TextField label="RSVPs" name="rsvps" inputMode="numeric" pattern="[0-9]*" defaultValue={v?.rsvps ?? (rsvps === null ? "" : String(rsvps))} error={e.rsvps} hint="From the RSVP form." />
        <TextField label="Came" name="attendance" inputMode="numeric" pattern="[0-9]*" defaultValue={v?.attendance ?? (attendance === null ? "" : String(attendance))} error={e.attendance} hint="Headcount at the door." />
      </div>
      <TextArea label="Note" name="resultsNote" rows={2} defaultValue={v?.resultsNote ?? note} error={e.resultsNote} hint="What worked, what to change next time. Only officers see it." maxLength={500} />
      <FormMessage message={state.message} tone={state.ok ? "plain" : "danger"} />
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save results"}
        </button>
      </div>
    </form>
  );
}
