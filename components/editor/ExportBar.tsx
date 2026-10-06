"use client";

import { useState } from "react";
import { downloadPng, downloadZip, supportedFormats } from "@/lib/export/render";
import { exportJobs } from "@/lib/export/names";
import { FORMAT_LABEL, type Captions, type Format, type Slide } from "@/lib/posts/types";
import styles from "./editor.module.css";

/** PNG for what's on screen, or one zip with every slide in every chosen format and the captions. */
export function ExportBar({ slides, sel, format, formats, captions, errorCount }: { slides: Slide[]; sel: number; format: Format; formats: Format[]; captions: Captions; errorCount: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; danger?: boolean } | null>(null);
  const count = exportJobs(slides, formats, supportedFormats).length;

  async function run(kind: "one" | "all") {
    setBusy(true);
    setMsg({ text: kind === "one" ? "Drawing the image…" : "Getting ready…" });
    try {
      if (kind === "one") {
        await downloadPng(slides, sel, format);
        setMsg({ text: `Downloaded slide ${sel + 1}, ${FORMAT_LABEL[format]}.` });
      } else {
        const n = await downloadZip(slides, formats, captions, (text) => setMsg({ text: `${text}…` }));
        setMsg({ text: `Downloaded a zip with ${n} ${n === 1 ? "image" : "images"} and the captions.` });
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "The export failed. Try again.", danger: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.export} aria-labelledby="export-h">
      <h2 id="export-h" className="visually-hidden">
        Export
      </h2>
      <div className="btn-row">
        <button type="button" className="btn btn-s" disabled={busy} onClick={() => void run("one")}>
          Download PNG
        </button>
        <button type="button" className="btn btn-s btn-primary" disabled={busy || !count} onClick={() => void run("all")}>
          Download all{count ? ` (${count})` : ""}
        </button>
      </div>
      <p className={`${styles.hint} ${msg?.danger ? styles.errText : ""}`} role="status" aria-live="polite">
        {msg?.text ??
          (count
            ? `All: ${count} ${count === 1 ? "image" : "images"} and captions.${errorCount ? ` ${errorCount} brand ${errorCount === 1 ? "error" : "errors"} left.` : ""}`
            : "Pick a format to export in post settings.")}
      </p>
    </section>
  );
}
