"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { uploadImage, type AssetKind, type UploadedAsset } from "@/lib/uploads/client";
import styles from "./ImageDrop.module.css";

/**
 * Pick or drop one image; it is re-encoded, uploaded and recorded, then onUploaded gets the
 * asset. `mode` comes from the server (lib/uploads/mode.ts) so the browser knows whether
 * uploads are available. Errors are shown in place, in words that say what to do.
 */
export function ImageDrop({
  kind,
  mode,
  onUploaded,
  label,
  current,
  compact = false,
}: {
  kind: AssetKind;
  mode: "blob" | "dev" | "off";
  onUploaded: (asset: UploadedAsset) => void;
  label?: ReactNode;
  current?: string | null;
  compact?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function take(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadImage(file, kind, mode));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed. Try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const action = current ? "Replace" : kind === "logo" ? "Add logo" : "Add photo";
  return (
    // Dropping a file is a mouse shortcut; the labelled file button does the same by keyboard.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`${styles.drop} ${compact ? styles.compact : ""} ${over ? styles.over : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void take(e.dataTransfer.files[0]);
      }}
    >
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="" className={kind === "logo" ? styles.logo : styles.thumb} />
      ) : (
        <span className={styles.empty} aria-hidden="true" />
      )}
      <div className={styles.body}>
        {label ? <span className={styles.label}>{label}</span> : null}
        <label htmlFor={id} className="btn btn-s" aria-disabled={busy || mode === "off" ? true : undefined}>
          {busy ? "Uploading…" : action}
        </label>
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml,image/heic"
          className="visually-hidden"
          disabled={busy || mode === "off"}
          onChange={(e) => void take(e.target.files?.[0])}
        />
        {!compact ? <span className={styles.hint}>{mode === "off" ? "Uploads aren’t set up yet." : "Or drop an image here."}</span> : null}
        <span role="status" aria-live="polite" className={styles.error}>{error}</span>
      </div>
    </div>
  );
}
