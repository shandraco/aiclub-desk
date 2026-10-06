"use client";

import { useActionState, useEffect, useState } from "react";
import { FormMessage } from "@/components/forms/Field";
import type { FormState } from "@/lib/actions";
import { Dialog } from "@/lib/team/ui/Dialog";
import { saveResults } from "./actions";
import { channelLabel, METRICS, type MetricKey } from "./metrics";
import styles from "./results.module.css";

export type ChannelNumbers = Record<string, Record<MetricKey, number | null>>;

export function ResultsButton({ postId, title, channels, current, has }: { postId: string; title: string; channels: string[]; current: ChannelNumbers; has: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={has ? "btn btn-s" : "btn btn-s btn-primary"} onClick={() => setOpen(true)} aria-label={`${has ? "Update" : "Enter"} numbers for ${title}`}>
        {has ? "Update" : "Enter numbers"}
      </button>
      {open ? (
        <Dialog title={`Numbers for ${title}`} onClose={() => setOpen(false)} wide>
          <ResultsForm postId={postId} channels={channels} current={current} onDone={() => setOpen(false)} />
        </Dialog>
      ) : null}
    </>
  );
}

function ResultsForm({ postId, channels, current, onDone }: { postId: string; channels: string[]; current: ChannelNumbers; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveResults, {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} noValidate>
      <input type="hidden" name="postId" value={postId} />
      <p className="hint">From each post’s insights. Leave a box blank if the channel doesn’t show that number.</p>
      {channels.map((c, ci) => (
        <fieldset key={c} className={styles.channel}>
          <legend>{channelLabel(c)}</legend>
          <div className={styles.metrics}>
            {METRICS.map((m, mi) => {
              const name = `${c}.${m.key}`;
              const id = `r-${c}-${m.key}`;
              const err = state.errors?.[name];
              const v = current[c]?.[m.key];
              return (
                <div key={m.key} className="field">
                  <label htmlFor={id}>{m.label}</label>
                  <input
                    id={id}
                    name={name}
                    className="input figures"
                    inputMode="numeric"
                    autoComplete="off"
                    data-autofocus={ci === 0 && mi === 0 ? true : undefined}
                    defaultValue={state.values?.[name] ?? (v === null || v === undefined ? "" : String(v))}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={err ? `${id}-error` : m.hint ? `${id}-hint` : undefined}
                  />
                  {err ? <span id={`${id}-error`} className="error">{err}</span> : m.hint ? <span id={`${id}-hint`} className="hint">{m.hint}</span> : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className={styles.formFoot}>
        <FormMessage message={state.ok ? undefined : state.message} />
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save numbers"}</button>
          <button type="button" className="btn" onClick={onDone}>Cancel</button>
        </div>
      </div>
    </form>
  );
}
