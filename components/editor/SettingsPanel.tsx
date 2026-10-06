"use client";

import { KIND_LABEL } from "@/lib/brand/presets";
import { FORMAT_LABEL, TEMPLATES, type Format, type Slide } from "@/lib/posts/types";
import { fromLocalInput, fmtDateTime, relativeDay } from "@/lib/time";
import { Check } from "./fields";
import type { Channel, Draft, Kind } from "./types";
import styles from "./editor.module.css";

const CHANNELS: [Channel, string][] = [
  ["instagram", "Instagram feed"],
  ["story", "Instagram story"],
  ["linkedin", "LinkedIn"],
];
const FORMATS: Format[] = ["feed", "story", "wide"];

export function SettingsPanel({ draft, slides, onChange, readOnly }: { draft: Draft; slides: Slide[]; onChange: (patch: Partial<Draft>) => void; readOnly: boolean }) {
  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list.filter((x) => x !== v), v] : list.filter((x) => x !== v));
  const when = fromLocalInput(draft.scheduled);
  return (
    <section className="panel" id="settings" aria-labelledby="settings-h">
      <h2 id="settings-h">Post settings</h2>
      <fieldset disabled={readOnly} className={styles.settings}>
        <fieldset className={styles.group}>
          <legend>Where it goes</legend>
          {CHANNELS.map(([c, label]) => (
            <Check key={c} id={`ch-${c}`} label={label} checked={draft.channels.includes(c)} onChange={(on) => onChange({ channels: toggle(draft.channels, c, on) })} />
          ))}
        </fieldset>
        <fieldset className={styles.group}>
          <legend>Formats to export</legend>
          {FORMATS.map((f) => {
            const fits = slides.filter((s) => TEMPLATES[s.template].formats.includes(f)).length;
            return (
              <Check
                key={f}
                id={`fmt-${f}`}
                label={FORMAT_LABEL[f]}
                hint={fits === 0 ? " None of these slides come in this format." : fits < slides.length ? ` ${fits} of ${slides.length} slides come in this format.` : undefined}
                checked={draft.formats.includes(f)}
                onChange={(on) => onChange({ formats: FORMATS.filter((x) => (x === f ? on : draft.formats.includes(x))) })}
              />
            );
          })}
        </fieldset>
        <div className={styles.field}>
          <label htmlFor="f-scheduled">Scheduled for</label>
          <input id="f-scheduled" type="datetime-local" className="input" value={draft.scheduled} onChange={(e) => onChange({ scheduled: e.target.value })} aria-describedby="f-scheduled-hint" />
          <span id="f-scheduled-hint" className={styles.hint}>
            Wichita time.{when ? ` ${fmtDateTime(when)}, ${relativeDay(when)}.` : " Not scheduled yet."}
          </span>
          {draft.scheduled ? (
            <button type="button" className={`btn btn-s btn-quiet ${styles.start}`} onClick={() => onChange({ scheduled: "" })}>
              Clear the date
            </button>
          ) : null}
        </div>
        <div className={styles.field}>
          <label htmlFor="f-kind">Kind of post</label>
          <select id="f-kind" className="input" value={draft.kind} onChange={(e) => onChange({ kind: e.target.value as Kind })}>
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
    </section>
  );
}
