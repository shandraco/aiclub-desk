"use client";

import { useState } from "react";
import { z } from "zod";
import { words, type Issue } from "@/lib/brand/checks";
import { fetchJson } from "@/lib/fetch-json";
import type { Captions } from "@/lib/posts/types";
import { EText } from "./fields";
import styles from "./editor.module.css";

const Draft = z.object({
  captions: z.object({ linkedin: z.string(), instagram: z.string(), alt: z.string() }),
  issues: z.array(z.unknown()),
});

const FIELDS = [
  ["linkedin", "LinkedIn"],
  ["instagram", "Instagram"],
  ["alt", "Alt text"],
] as const;
type Key = (typeof FIELDS)[number][0];

function hashtags(s: string) {
  return (s.match(/(^|\s)#\w+/g) ?? []).length;
}

/** Counters that say what each platform cares about. */
function counter(k: Key, v: string): { text: string; over: boolean } {
  if (k === "linkedin") {
    const w = words(v);
    return { text: `${w} words, aim for 60 to 150; ${hashtags(v)} of 3 hashtags`, over: !!v && (w < 60 || w > 150 || hashtags(v) > 3) };
  }
  if (k === "instagram") {
    const first = (v.split("\n")[0] ?? "").length;
    return { text: `First line ${first} of 125; ${hashtags(v)} of 5 hashtags`, over: first > 125 || hashtags(v) > 5 };
  }
  return { text: `${v.length} characters, under 400`, over: v.length > 400 };
}

function CopyButton({ text, what }: { text: string; what: string }) {
  const [done, setDone] = useState<string>("");
  return (
    <>
      <button
        type="button"
        className="btn btn-s"
        disabled={!text.trim()}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setDone("Copied");
          } catch {
            setDone("Couldn’t copy. Select the text and copy it yourself.");
          }
          setTimeout(() => setDone(""), 2500);
        }}
      >
        Copy {what}
      </button>
      <span role="status" className={styles.hint}>
        {done}
      </span>
    </>
  );
}

/**
 * The three captions with counters and copy buttons, and the "Draft captions" button. Drafts
 * never overwrite what someone wrote without asking: when a box has text, the draft is shown
 * next to it with "Use this".
 */
export function CaptionsPanel({
  captions,
  onChange,
  issuesFor,
  postId,
  flush,
  readOnly,
}: {
  captions: Captions;
  onChange: (c: Captions) => void;
  issuesFor: (path: string) => Issue[];
  postId: string;
  flush: () => Promise<boolean>;
  readOnly: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; danger?: boolean } | null>(null);
  const [offer, setOffer] = useState<{ captions: Captions } | null>(null);

  async function draft() {
    setBusy(true);
    setMsg({ text: "Saving, then filling in…" });
    try {
      const saved = await flush();
      if (!saved) {
        setMsg({ text: "Save didn’t go through, so there’s nothing new to draft from. Fix the save problem above first.", danger: true });
        return;
      }
      const res = await fetchJson("/api/captions", Draft, { method: "POST", body: JSON.stringify({ postId }) });
      if (!res.ok) {
        const p = res.problem;
        const text =
          res.status === 401
                ? "Your session ended. Sign in again in another tab, then try again."
                : res.status === 0
                  ? "Couldn’t reach the desk. Check your connection and try again."
                  : `Drafting failed on our side. Try again; if it repeats, tell an admin${p.request_id ? ` (reference ${p.request_id})` : ""}.`;
        setMsg({ text, danger: true });
        return;
      }
      const { captions: c } = res.data;
      const hasText = FIELDS.some(([k]) => captions[k].trim());
      if (hasText) {
        setOffer({ captions: c });
        setMsg({ text: "Your captions are kept. Pick which starting points to use below." });
      } else {
        onChange(c);
        setMsg({ text: "Filled in from the event’s facts. Add what makes it worth coming to, in your own words." });
      }
    } finally {
      setBusy(false);
    }
  }

  function use(k: Key) {
    if (!offer) return;
    onChange({ ...captions, [k]: offer.captions[k] });
    const left = FIELDS.filter(([x]) => x !== k && offer.captions[x] !== captions[x]);
    if (!left.length) setOffer(null);
  }

  return (
    <section className="panel" id="captions" aria-labelledby="captions-h">
      <h2 id="captions-h">
        Captions
      </h2>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => void draft()} disabled={busy || readOnly}>
          {busy ? "Filling in…" : "Fill in from the event"}
        </button>
        <span className={styles.hint}>Date, time, room and speakers, ready to edit. It saves first.</span>
      </div>
      <div role="status" aria-live="polite">
        {msg ? <p className={`notice ${msg.danger ? "notice-danger" : ""} ${styles.gapTop}`}>{msg.text}</p> : null}
      </div>
      {offer ? (
        <div className={styles.offer}>
          <p>
            <b>Filled in from the event</b>
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-s"
              onClick={() => {
                onChange(offer.captions);
                setOffer(null);
              }}
            >
              Replace all three
            </button>
            <button type="button" className="btn btn-s btn-quiet" onClick={() => setOffer(null)}>
              Keep mine
            </button>
          </div>
        </div>
      ) : null}
      {FIELDS.map(([k, label]) => {
        const c = counter(k, captions[k]);
        return (
          <div key={k} className={styles.caption}>
            <EText
              label={label}
              path={`captions.${k}`}
              rows={k === "alt" ? 3 : 7}
              value={captions[k]}
              maxLength={k === "alt" ? 1500 : 5000}
              onChange={(e) => onChange({ ...captions, [k]: e.target.value })}
              count={c.text}
              over={c.over}
              issues={issuesFor(`captions.${k}`)}
              readOnly={readOnly}
            />
            <div className="btn-row">
              <CopyButton text={captions[k]} what={label === "Alt text" ? "alt text" : `${label} caption`} />
            </div>
            {offer && offer.captions[k] && offer.captions[k] !== captions[k] ? (
              <div className={styles.offerField}>
                <p className={styles.hint}>Draft for {label}</p>
                <p className={styles.offerText}>{offer.captions[k]}</p>
                <button type="button" className="btn btn-s" onClick={() => use(k)}>
                  Use this for {label}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
