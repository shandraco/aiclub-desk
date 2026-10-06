"use client";

import { useActionState } from "react";
import { FormMessage, TextArea, TextField } from "@/components/forms/Field";
import type { FormState } from "@/lib/actions";
import { startFromTemplate } from "../actions";

const CHANNELS = [
  ["instagram", "Instagram feed"],
  ["story", "Instagram story"],
  ["linkedin", "LinkedIn"],
] as const;

/** The manual start: a few facts now, everything else in the editor. */
export function StartFromTemplate({ template, series, formats, events }: { template: string; series: string; formats: [string, string][]; events: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(startFromTemplate, {});
  const v = state.values;
  const checked = (name: string, value: string, fallback: boolean) => (v ? (v[name] ?? "").split(",").includes(value) : fallback);
  return (
    <form action={action} noValidate style={{ display: "grid", gap: "var(--space-s)" }}>
      <input type="hidden" name="template" value={template} />
      <TextArea label="Headline" name="headline" rows={2} hint="Optional now. Twelve words at most; you can change it in the editor." defaultValue={v?.headline} error={state.errors?.headline} />
      <TextField label="Series label" name="series" hint="The small line at the top, like “Workshop 04”." defaultValue={v?.series ?? series} error={state.errors?.series} />
      <div className="field">
        <label htmlFor="f-eventId">Event</label>
        <select id="f-eventId" name="eventId" className="input" defaultValue={v?.eventId ?? ""} aria-describedby="f-eventId-hint">
          <option value="">None, it stands on its own</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
        <span id="f-eventId-hint" className="hint">
          Linking fills in the date, time, room, speakers and partners.
        </span>
        {state.errors?.eventId ? <span className="error">{state.errors.eventId}</span> : null}
      </div>
      <TextField label="When it goes out" name="when" type="datetime-local" hint="Wichita time. Optional; it shows on the week board and calendar." defaultValue={v?.when} error={state.errors?.when} />
      <fieldset className="field" style={{ border: 0, padding: 0 }}>
        <legend className="label">Where it goes</legend>
        {CHANNELS.map(([value, label]) => (
          <label key={value} className="check">
            <input type="checkbox" name="channels" value={value} defaultChecked={checked("channels", value, value === "instagram")} />
            {label}
          </label>
        ))}
        {state.errors?.channels ? <span className="error">{state.errors.channels}</span> : null}
      </fieldset>
      <fieldset className="field" style={{ border: 0, padding: 0 }}>
        <legend className="label">Sizes to export</legend>
        {formats.map(([value, label]) => (
          <label key={value} className="check">
            <input type="checkbox" name="formats" value={value} defaultChecked={checked("formats", value, value === formats[0]![0])} />
            {label}
          </label>
        ))}
        {state.errors?.formats ? <span className="error">{state.errors.formats}</span> : null}
      </fieldset>
      <FormMessage message={state.message} />
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ justifySelf: "start", minBlockSize: "2.75rem" }}>
        {pending ? "Starting…" : "Start this post"}
      </button>
    </form>
  );
}
