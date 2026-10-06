"use client";

import { useRef, useState } from "react";
import { PostThumb } from "@/components/post/PostThumb";
import { TEMPLATES, type Format, type Slide, type TemplateKey } from "@/lib/posts/types";
import styles from "./editor.module.css";

/**
 * The filmstrip: every slide as a thumbnail. Click to edit a slide; drag a thumbnail to
 * reorder, or focus it and press Alt with an arrow key. Tools act on the current slide.
 */
export function SlideStrip({
  slides,
  sel,
  format,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onReorder,
  readOnly,
}: {
  slides: Slide[];
  sel: number;
  format: Format;
  onSelect: (i: number) => void;
  onAdd: (t: TemplateKey | undefined) => void;
  onDuplicate: (i: number) => void;
  onDelete: (i: number) => void;
  onReorder: (from: number, to: number) => void;
  readOnly: boolean;
}) {
  const [tpl, setTpl] = useState<"" | TemplateKey>("");
  const [over, setOver] = useState<number | null>(null);
  const from = useRef<number | null>(null);
  const n = slides.length;

  function moveFocus(i: number) {
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-thumb="${i}"]`)?.focus());
  }

  return (
    <section className={styles.strip} aria-label="Slides">
      <ol className={styles.thumbs}>
        {slides.map((s, i) => {
          const f = TEMPLATES[s.template].formats.includes(format) ? format : TEMPLATES[s.template].formats[0]!;
          return (
            // Drag to reorder is a pointer shortcut; Alt+arrow on the thumbnail button does the same.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <li
              key={s.id}
              className={`${i === sel ? styles.thumbOn : ""} ${over === i ? styles.thumbOver : ""}`}
              draggable={!readOnly}
              onDragStart={(e) => {
                from.current = i;
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => {
                if (from.current === null) return;
                e.preventDefault();
                setOver(i);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (from.current !== null && from.current !== i) onReorder(from.current, i);
                from.current = null;
              }}
              onDragEnd={() => {
                from.current = null;
                setOver(null);
              }}
            >
              <button
                type="button"
                data-thumb={i}
                className={styles.thumbBtn}
                onClick={() => onSelect(i)}
                onKeyDown={(e) => {
                  if (!e.altKey || readOnly) return;
                  if (e.key === "ArrowLeft" && i > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    onReorder(i, i - 1);
                    moveFocus(i - 1);
                  } else if (e.key === "ArrowRight" && i < n - 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    onReorder(i, i + 1);
                    moveFocus(i + 1);
                  }
                }}
                aria-current={i === sel ? "true" : undefined}
                aria-label={`Slide ${i + 1} of ${n}, ${TEMPLATES[s.template].name}${s.fields.headline ? `: ${s.fields.headline}` : ""}. Alt and an arrow key moves it.`}
              >
                <PostThumb slide={s} format={f} width={f === "wide" ? 92 : f === "story" ? 40 : 56} />
              </button>
              <span className={`figures ${styles.thumbNum}`} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
            </li>
          );
        })}
      </ol>
      {!readOnly ? (
        <div className={styles.stripTools}>
          <div className={styles.stripAdd}>
            <label htmlFor="add-tpl" className="visually-hidden">
              Template for the new slide
            </label>
            <select id="add-tpl" className={`input ${styles.small}`} value={tpl} onChange={(e) => setTpl(e.target.value as "" | TemplateKey)}>
              <option value="">Like this slide</option>
              {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
                <option key={k} value={k}>
                  {TEMPLATES[k].name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-s" disabled={n >= 10} onClick={() => onAdd(tpl || undefined)}>
              Add slide
            </button>
          </div>
          <div className="btn-row" role="group" aria-label={`Slide ${sel + 1}`}>
            <button type="button" className="btn btn-s btn-quiet" disabled={n >= 10} onClick={() => onDuplicate(sel)}>
              Duplicate
            </button>
            <button type="button" className="btn btn-s btn-quiet btn-danger" disabled={n <= 1} onClick={() => onDelete(sel)}>
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
