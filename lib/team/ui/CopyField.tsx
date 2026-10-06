"use client";

import { useId, useRef, useState } from "react";
import styles from "./ui.module.css";

/** A read-only value with a Copy button: for an invite link or a temporary password. */
export function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("yes");
    } catch {
      input.current?.select();
      setCopied("no");
    }
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={styles.copyRow}>
        <input
          ref={input}
          id={id}
          className={`input ${styles.copyInput}`}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          aria-describedby={hint ? `${id}-hint` : undefined}
          spellCheck={false}
        />
        <button type="button" className="btn btn-primary" onClick={() => void copy()}>
          Copy
        </button>
      </div>
      {hint ? <span id={`${id}-hint`} className="hint">{hint}</span> : null}
      <span role="status" aria-live="polite" className="hint">
        {copied === "yes" ? "Copied." : copied === "no" ? "Couldn’t reach the clipboard. The text is selected: press Ctrl+C or ⌘C." : ""}
      </span>
    </div>
  );
}
