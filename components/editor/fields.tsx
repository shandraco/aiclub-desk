"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import type { Issue } from "@/lib/brand/checks";
import styles from "./editor.module.css";

/**
 * The editor's labelled controls. Each takes the brand-check path it belongs to, so its id
 * is predictable (clicking an issue focuses it) and its own issues show under it.
 */
export const fid = (path: string) => `f-${path.replace(/[^\w-]+/g, "-")}`;

export function IssueList({ issues, id }: { issues: Issue[]; id?: string }) {
  if (!issues.length) return null;
  return (
    <ul className={styles.inlineIssues} id={id}>
      {issues.map((i, n) => (
        <li key={n} className={i.level === "error" ? styles.fix : styles.check}>
          <b>{i.level === "error" ? "Fix" : "Check"}</b> {i.text.replace(/^Slide \d+: /, "")}
        </li>
      ))}
    </ul>
  );
}

interface Common {
  label: ReactNode;
  path: string;
  issues?: Issue[];
  /** Shown at the label's end: "4 of 12 words". */
  count?: ReactNode;
  over?: boolean;
  hint?: ReactNode;
}

function Head({ id, label, count, over }: { id: string; label: ReactNode; count?: ReactNode; over?: boolean }) {
  return (
    <span className={styles.fieldHead}>
      <label htmlFor={id}>{label}</label>
      {count !== undefined ? (
        <span className={`${styles.count} ${over ? styles.countOver : ""}`} aria-live="polite">
          {count}
        </span>
      ) : null}
    </span>
  );
}

const describedBy = (id: string, hint?: ReactNode, issues?: Issue[]) =>
  [hint ? `${id}-hint` : "", issues?.length ? `${id}-issues` : ""].filter(Boolean).join(" ") || undefined;

export function EInput({ label, path, issues = [], count, over, hint, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = fid(path);
  return (
    <div className={styles.field} data-path={path}>
      <Head id={id} label={label} count={count} over={over} />
      <input
        id={id}
        className="input"
        aria-invalid={issues.some((i) => i.level === "error") || undefined}
        aria-describedby={describedBy(id, hint, issues)}
        {...rest}
      />
      {hint ? <span id={`${id}-hint`} className={styles.hint}>{hint}</span> : null}
      <IssueList issues={issues} id={`${id}-issues`} />
    </div>
  );
}

export function EText({ label, path, issues = [], count, over, hint, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = fid(path);
  return (
    <div className={styles.field} data-path={path}>
      <Head id={id} label={label} count={count} over={over} />
      <textarea
        id={id}
        className="input"
        aria-invalid={issues.some((i) => i.level === "error") || undefined}
        aria-describedby={describedBy(id, hint, issues)}
        {...rest}
      />
      {hint ? <span id={`${id}-hint`} className={styles.hint}>{hint}</span> : null}
      <IssueList issues={issues} id={`${id}-issues`} />
    </div>
  );
}

/** Segmented radios (the global .seg control) with a visible group label. */
export function Seg<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  label: ReactNode;
  name: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className={styles.segField} disabled={disabled}>
      <legend>{label}</legend>
      <div className="seg">
        {options.map(([v, text]) => (
          <label key={v}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Check({ label, checked, onChange, id, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; id: string; hint?: ReactNode }) {
  return (
    <label className="check" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint ? <span className={styles.checkHint}>{hint}</span> : null}
      </span>
    </label>
  );
}

/** A labelled range with its value shown, for focus point and zoom. */
export function Range({ label, id, value, min, max, step, onChange, format }: { label: string; id: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <div className={styles.range}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={format(value)} />
      <output htmlFor={id} className="figures">{format(value)}</output>
    </div>
  );
}
