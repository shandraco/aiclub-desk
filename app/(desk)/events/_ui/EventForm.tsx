"use client";

import type { Route } from "next";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { FormMessage, TextArea, TextField } from "@/components/forms/Field";
import type { FormState } from "@/lib/actions";
import { EVENT_PRESETS, presetByKey } from "@/lib/brand/presets";
import { nextSeriesLabel, planChoices } from "@/lib/planning";
import { dayKey, fmtDate, fmtTime, fromLocalInput } from "@/lib/time";
import { saveEvent } from "../actions";
import f from "./form.module.css";

interface Choice {
  id: string;
  name: string;
  sub?: string;
}

export interface EventFormInitial {
  id?: string;
  title: string;
  preset: string;
  seriesLabel: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  roomId: string;
  place: string;
  rsvpUrl: string;
  speakers: string[];
  partners: string[];
}

export function EventForm({
  initial,
  rooms,
  speakers,
  partners,
  presetCounts,
  now,
}: {
  initial: EventFormInitial;
  rooms: Choice[];
  speakers: Choice[];
  partners: Choice[];
  presetCounts: Record<string, number>;
  /** Server time as ISO, so "already past" matches the server's idea of now. */
  now: string;
}) {
  const editing = !!initial.id;
  const [state, action, pending] = useActionState<FormState, FormData>(saveEvent, {});
  const v = state.values;
  const e = state.errors ?? {};
  const list = (s: string | undefined, fallback: string[]) => (s === undefined ? fallback : s ? s.split(",") : []);

  const [preset, setPreset] = useState(initial.preset);
  const [label, setLabel] = useState(initial.seriesLabel || nextSeriesLabel(initial.preset, presetCounts[initial.preset] ?? 0));
  const [labelTouched, setLabelTouched] = useState(editing);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [chosenSpeakers, setChosenSpeakers] = useState(initial.speakers);
  const [chosenPartners, setChosenPartners] = useState(initial.partners);
  const [planTouched, setPlanTouched] = useState<Record<string, boolean>>({});

  // After a failed submit, the server echoes what was sent; adopt it once.
  const [seen, setSeen] = useState<FormState["values"]>(undefined);
  if (v && v !== seen) {
    setSeen(v);
    if (v.preset) setPreset(v.preset);
    if (v.seriesLabel !== undefined) setLabel(v.seriesLabel);
    if (v.startsAt !== undefined) setStartsAt(v.startsAt);
    if (v.endsAt !== undefined) setEndsAt(v.endsAt);
    setChosenSpeakers(list(v.speakers, chosenSpeakers));
    setChosenPartners(list(v.partners, chosenPartners));
    if (!editing) {
      const sent = new Set(list(v.plan, []));
      setPlanTouched(Object.fromEntries(["announce", "linkedin", "reminder", "day_of", "recap"].map((k) => [k, sent.has(k)])));
    }
  }

  const start = fromLocalInput(startsAt);
  const end = fromLocalInput(endsAt);
  const choices = start ? planChoices(start, new Date(now), end) : [];
  const presetInfo = presetByKey(preset);
  const startDayChanged = editing && start && fromLocalInput(initial.startsAt) && dayKey(start) !== dayKey(fromLocalInput(initial.startsAt)!);

  function changePreset(key: string) {
    setPreset(key);
    if (!labelTouched) setLabel(nextSeriesLabel(key, presetCounts[key] ?? 0));
  }

  const libraryEmpty = !rooms.length && !speakers.length && !partners.length;

  return (
    <form
      action={action}
      noValidate
      className={f.form}
      onSubmit={(ev) => {
        // Submit without React's automatic form reset, which would snap the controlled selects back.
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <section className={f.group} aria-labelledby="g-what">
        <h2 id="g-what" className={f.groupHead}>What it is</h2>
        <div className={f.fields}>
          <TextField label="Title" name="title" required defaultValue={v?.title ?? initial.title} error={e.title} hint="This is the graphic's headline. Sentence case, 12 words or fewer." maxLength={90} />
          <div className="grid-2">
            <div className="field">
              <label htmlFor="f-preset">Series</label>
              <select id="f-preset" name="preset" className="input" value={preset} onChange={(ev) => changePreset(ev.target.value)} aria-describedby="f-preset-hint" aria-invalid={e.preset ? true : undefined}>
                {EVENT_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span id="f-preset-hint" className="hint">{presetInfo.description}</span>
              {e.preset ? <span className="error"><span className="visually-hidden">Error: </span>{e.preset}</span> : null}
            </div>
            <TextField
              label="Series label"
              name="seriesLabel"
              value={label}
              onChange={(ev) => {
                setLabel(ev.target.value);
                setLabelTouched(true);
              }}
              error={e.seriesLabel}
              hint={labelTouched ? "As it reads in the graphic's header." : "Numbered from the events already in this series."}
              maxLength={40}
            />
          </div>
          <TextArea label="One-sentence summary" name="summary" rows={2} defaultValue={v?.summary ?? initial.summary} error={e.summary} hint="Used under the headline and in caption drafts." maxLength={240} />
        </div>
      </section>

      <section className={f.group} aria-labelledby="g-when">
        <h2 id="g-when" className={f.groupHead}>When and where</h2>
        <div className={f.fields}>
          <div className="grid-2">
            <TextField label="Starts" name="startsAt" type="datetime-local" required value={startsAt} onChange={(ev) => setStartsAt(ev.target.value)} error={e.startsAt} hint="Wichita time." />
            <TextField label="Ends (optional)" name="endsAt" type="datetime-local" value={endsAt} onChange={(ev) => setEndsAt(ev.target.value)} error={e.endsAt} hint="Leave empty for a single session." />
          </div>
          {startDayChanged ? (
            <label className={`check ${f.move}`}>
              <input type="checkbox" name="movePosts" defaultChecked />
              <span>
                Move this event&rsquo;s unpublished posts by the same number of days.
                <span className="muted"> Approved ones go back to review, since their graphics show the old date.</span>
              </span>
            </label>
          ) : null}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="f-roomId">Room</label>
              <select id="f-roomId" name="roomId" className="input" defaultValue={v?.roomId ?? initial.roomId} aria-invalid={e.roomId ? true : undefined} aria-describedby={e.roomId ? "f-roomId-error" : "f-roomId-hint"}>
                <option value="">Not in the library</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.sub && r.sub !== r.name ? ` (${r.sub})` : ""}
                  </option>
                ))}
              </select>
              <span id="f-roomId-hint" className="hint">
                {rooms.length ? "Shows on the graphic's data strip." : <>No rooms yet. <Link href={"/library" as Route}>Add them in the library</Link>, or write the place.</>}
              </span>
              {e.roomId ? <span id="f-roomId-error" className="error"><span className="visually-hidden">Error: </span>{e.roomId}</span> : null}
            </div>
            <TextField label="Or a place" name="place" defaultValue={v?.place ?? initial.place} error={e.place} hint="Anywhere not in the library: “Online”, “Shocker Hall lawn”." maxLength={80} />
          </div>
          <TextField label="RSVP link (optional)" name="rsvpUrl" type="url" inputMode="url" placeholder="https://" defaultValue={v?.rsvpUrl ?? initial.rsvpUrl} error={e.rsvpUrl} hint="A full https:// link." />
        </div>
      </section>

      <section className={f.group} aria-labelledby="g-who">
        <h2 id="g-who" className={f.groupHead}>Who</h2>
        <div className={f.fields}>
          {libraryEmpty ? (
            <p className="notice">
              The library has no speakers or partners yet. <Link href={"/library" as Route}>Add them in the library</Link> and they&rsquo;ll appear here; you can come back and edit the event.
            </p>
          ) : null}
          <OrderedPicker label="Speakers" name="speakers" max={4} options={speakers} value={chosenSpeakers} onChange={setChosenSpeakers} error={e.speakers} hint="In the order they appear on the graphic. Up to 4." emptyHint="No speakers in the library yet." />
          <OrderedPicker label="Partners" name="partners" max={3} options={partners} value={chosenPartners} onChange={setChosenPartners} error={e.partners} hint="Their logos go in the footer. Up to 3." emptyHint="No partners in the library yet." />
        </div>
      </section>

      {!editing ? (
        <section className={f.group} aria-labelledby="g-plan">
          <h2 id="g-plan" className={f.groupHead}>Post plan</h2>
          <fieldset className={f.fields}>
            <legend className="visually-hidden">Posts to create with this event</legend>
            {choices.length ? (
              <>
                <p className={`muted ${f.lead}`}>Each ticked post is created as a draft on its date, filled in from this event. You can move or delete any of them later.</p>
                <ul className={f.plan}>
                  {choices.map((c) => {
                    const checked = planTouched[c.step.kind] ?? c.checked;
                    return (
                      <li key={c.step.kind}>
                        <label className="check">
                          <input type="checkbox" name="plan" value={c.step.kind} checked={checked} onChange={(ev) => setPlanTouched((t) => ({ ...t, [c.step.kind]: ev.target.checked }))} />
                          <span>
                            <b>{c.step.label}</b> <span className="figures">· {fmtDate(c.at)} · {fmtTime(c.at, true)}</span>
                            <span className="muted"> · {c.step.channels.map((ch) => (ch === "instagram" ? "Instagram" : ch === "linkedin" ? "LinkedIn" : "Story")).join(", ")}</span>
                            {c.past ? <span className={f.past}> Already past; tick it to make it anyway.</span> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {start && (end ?? start).getTime() < new Date(now).getTime() ? <p className="muted">This event is over, so only a recap is offered.</p> : null}
              </>
            ) : (
              <p className="muted">Set when it starts and the plan&rsquo;s dates appear here.</p>
            )}
          </fieldset>
        </section>
      ) : null}

      <div className={f.submit}>
        <FormMessage message={state.message} />
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add event and its posts"}
          </button>
          <Link href={(initial.id ? `/events/${initial.id}` : "/events") as never} className="btn btn-quiet">
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}

/** Pick several from a list, in order: add from a select, move up or remove. */
function OrderedPicker({
  label,
  name,
  max,
  options,
  value,
  onChange,
  error,
  hint,
  emptyHint,
}: {
  label: string;
  name: string;
  max: number;
  options: Choice[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  hint: string;
  emptyHint: string;
}) {
  const id = `f-${name}`;
  const byId = new Map(options.map((o) => [o.id, o]));
  const left = options.filter((o) => !value.includes(o.id));
  const full = value.length >= max;
  const move = (i: number) => {
    const next = [...value];
    [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
    onChange(next);
  };
  return (
    <div className="field">
      {options.length ? <label htmlFor={id}>{label}</label> : <span className="label">{label}</span>}
      {value.length ? (
        <ol className={f.chosen} aria-label={`Chosen ${label.toLowerCase()}`}>
          {value.map((sid, i) => {
            const o = byId.get(sid);
            const n = o?.name ?? "Removed from the library";
            return (
              <li key={sid}>
                <input type="hidden" name={name} value={sid} />
                <span className={`figures muted ${f.ord}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className={f.who}>
                  <b>{n}</b>
                  {o?.sub ? <span className="muted"> · {o.sub}</span> : null}
                </span>
                <span className="btn-row">
                  {i > 0 ? (
                    <button type="button" className="btn btn-s btn-quiet" onClick={() => move(i)} aria-label={`Move ${n} up`}>
                      Up
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-s btn-quiet" onClick={() => onChange(value.filter((x) => x !== sid))} aria-label={`Remove ${n}`}>
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {options.length ? (
        <select
          id={id}
          className="input"
          value=""
          disabled={full || !left.length}
          aria-describedby={[`${id}-hint`, error ? `${id}-error` : ""].filter(Boolean).join(" ")}
          aria-invalid={error ? true : undefined}
          onChange={(ev) => ev.target.value && onChange([...value, ev.target.value])}
        >
          <option value="">{full ? `That's the most a graphic fits (${max})` : left.length ? `Add ${label.toLowerCase().replace(/s$/, "")}…` : "Everyone in the library is added"}</option>
          {left.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.sub ? ` · ${o.sub}` : ""}
            </option>
          ))}
        </select>
      ) : (
        <span className="muted">
          {emptyHint} <Link href={"/library" as Route}>Open the library</Link>
        </span>
      )}
      <span id={`${id}-hint`} className="hint">{hint}</span>
      {error ? <span id={`${id}-error`} className="error"><span className="visually-hidden">Error: </span>{error}</span> : null}
    </div>
  );
}
