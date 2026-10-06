"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { PostCanvas } from "@/components/post/PostCanvas";
import type { Issue } from "@/lib/brand/checks";
import { uploadImage } from "@/lib/uploads/client";
import { FORMAT_LABEL, SIZES, type Format, type ImageRef, type Slide } from "@/lib/posts/types";
import { clamp, getImage } from "./slots";
import { getText, isMultiline, maxLength, PLACEHOLDER, targetPath, textLabel } from "./targets";
import type { UploadMode } from "./types";
import styles from "./canvas.module.css";

/** Something on the graphic that can be selected: its key and where it is, in stage pixels. */
interface Target {
  key: string;
  kind: "text" | "photo" | "partner";
  x: number;
  y: number;
  w: number;
  h: number;
  /** The element whose type the in-place editor copies. */
  el: HTMLElement;
}

export type Selection = { kind: "slide" } | { kind: "text"; key: string } | { kind: "photo"; slot: string } | { kind: "partner"; i: number };

/**
 * Finds every editable element in the rendered template through the editor contract in
 * PostCanvas: text carries data-field (its path in SlideFields), photo frames carry data-slot.
 * Nothing here knows a template's classes or layout, so new templates work unchanged.
 */
function scan(stage: HTMLElement): Target[] {
  const post = stage.querySelector<HTMLElement>(".aic-post") ?? stage;
  const base = stage.getBoundingClientRect();
  const out: Target[] = [];
  post.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    out.push({ key: `photo:${el.dataset.slot}`, kind: "photo", x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, el });
  });
  // One target per field; a field drawn in several pieces (paragraphs of a dek) is their union.
  const byField = new Map<string, HTMLElement[]>();
  post.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
    const k = el.dataset.field!;
    byField.set(k, [...(byField.get(k) ?? []), el]);
  });
  for (const [key, els] of byField) {
    const rects = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width >= 1 && r.height >= 1);
    if (!rects.length) continue;
    const l = Math.min(...rects.map((r) => r.left));
    const t = Math.min(...rects.map((r) => r.top));
    const rr = Math.max(...rects.map((r) => r.right));
    const b = Math.max(...rects.map((r) => r.bottom));
    out.push({ key, kind: "text", x: l - base.left, y: t - base.top, w: rr - l, h: b - t, el: els[0]! });
  }
  // Reading order, so Tab moves through the graphic top to bottom, left to right.
  return out.sort((a, b) => (Math.abs(a.y - b.y) < 6 ? a.x - b.x : a.y - b.y));
}

function targetLabel(t: Target, slide: Slide): string {
  if (t.kind === "photo") {
    const slot = t.key.slice(6);
    const img = getImage(slide.fields, slot);
    const [list, n] = slot.split(".");
    const what = list === "speakers" ? `Speaker ${Number(n) + 1} photo` : `Photo ${Number(n) + 1}`;
    return `${what}${img?.src ? "" : ", empty"}. Enter to select; arrow keys move it, plus and minus zoom.`;
  }
  if (t.kind === "partner") {
    const i = Number(t.key.split(":")[1]);
    return `Partner logo ${i + 1}: ${slide.fields.partners?.[i]?.name || "unnamed"}`;
  }
  const text = getText(slide.fields, t.key).replace(/\s+/g, " ").trim();
  return `Edit ${textLabel(t.key).toLowerCase()}: ${text.slice(0, 80)}`;
}

/** The in-place editor copies the face, size and colour of the words it covers, at canvas scale. */
function editorStyle(t: Target, stageEl: HTMLElement | null, scale: number): CSSProperties {
  const cs = getComputedStyle(t.el);
  const post = stageEl?.querySelector<HTMLElement>(".aic-post");
  const ground = post ? getComputedStyle(post).backgroundColor : undefined;
  const px = (v: string) => (v.endsWith("px") ? `${parseFloat(v) * scale}px` : v);
  return {
    left: t.x,
    top: t.y,
    width: Math.max(t.w, 40),
    minHeight: t.h,
    fontFamily: cs.fontFamily,
    fontWeight: cs.fontWeight,
    fontStyle: cs.fontStyle,
    fontSize: px(cs.fontSize),
    lineHeight: px(cs.lineHeight),
    letterSpacing: px(cs.letterSpacing),
    textTransform: cs.textTransform as CSSProperties["textTransform"],
    textAlign: cs.textAlign as CSSProperties["textAlign"],
    color: cs.color,
    background: ground,
  };
}
interface Drag {
  slot: string;
  x0: number;
  y0: number;
  ix: number;
  iy: number;
  k: number;
  ox: number;
  oy: number;
  moved: boolean;
  img: ImageRef;
}

/**
 * The graphic as the editor. The real template is drawn at a scale that fits the workspace;
 * a layer of transparent buttons sits over every editable element, so a click (or Tab and
 * Enter) opens an editor in place, typed in the graphic's own face. Photos drag to move,
 * scroll to zoom, take dropped files, and double-click opens the crop tool.
 */
export function CanvasEditor({
  slide,
  slideIndex,
  format,
  selection,
  editing,
  onSelect,
  onEdit,
  onText,
  onImage,
  onCrop,
  issues,
  issueNumber,
  uploadMode,
  readOnly,
  maxHeight,
  onMessage,
}: {
  slide: Slide;
  slideIndex: number;
  format: Format;
  selection: Selection;
  editing: string | null;
  onSelect: (s: Selection) => void;
  onEdit: (key: string | null, opts?: { returnFocus?: boolean }) => void;
  onText: (key: string, value: string) => void;
  onImage: (slot: string, img: ImageRef | null) => void;
  onCrop: (slot: string, frame: { w: number; h: number }) => void;
  issues: Issue[];
  issueNumber: (i: Issue) => number;
  uploadMode: UploadMode;
  readOnly: boolean;
  maxHeight: number;
  onMessage: (text: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pickSlot = useRef<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const [scale, setScale] = useState(0.4);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loads, setLoads] = useState(0);
  const [dropSlot, setDropSlot] = useState<string | null>(null);
  const lastRect = useRef<Record<string, Target>>({});
  const [w, h] = SIZES[format];

  // Fit the canvas into the workspace.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    // On a wide screen the workspace has a fixed height to fill; stacked, the window decides.
    const fit = () => {
      const tall = window.matchMedia("(min-width: 62rem)").matches && el.clientHeight > 200 ? el.clientHeight - 8 : maxHeight;
      setScale(Math.max(0.12, Math.min((el.clientWidth - 8) / w, tall / h, 1)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, maxHeight]);

  // Measure targets after every render of the graphic, and place the in-place editor.
  const [edit, setEdit] = useState<{ key: string; style: CSSProperties } | null>(null);
  useLayoutEffect(() => {
    if (!stage.current) return;
    const list = scan(stage.current);
    for (const t of list) lastRect.current[t.key] = t;
    setTargets(list);
    // While the field is empty its element is gone; keep the editor where the words were.
    const t = editing ? (list.find((x) => x.key === editing) ?? lastRect.current[editing]) : undefined;
    setEdit(editing && t ? { key: editing, style: editorStyle(t, stage.current, scale) } : null);
  }, [slide, format, scale, loads, editing]);
  useEffect(() => {
    void document.fonts?.ready.then(() => setLoads((n) => n + 1));
  }, []);

  // Wheel zoom on photos needs a non-passive listener.
  const latest = useRef({ slide, onImage, readOnly });
  useEffect(() => {
    latest.current = { slide, onImage, readOnly };
  });
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { slide: s, onImage: set, readOnly: ro } = latest.current;
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-photo]");
      if (ro || !t) return;
      const slot = t.dataset.photo!;
      const im = getImage(s.fields, slot);
      if (!im?.src) return;
      e.preventDefault();
      set(slot, { ...im, zoom: clamp((im.zoom ?? 1) * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), 1, 3) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const photoEl = (slot: string) => stage.current?.querySelector<HTMLElement>(`[data-slot="${CSS.escape(slot)}"]`) ?? null;

  /* ---------------- photo pointer handling ---------------- */
  function photoDown(e: PointerEvent<HTMLButtonElement>, slot: string) {
    if (e.button !== 0) return;
    const im = getImage(slide.fields, slot);
    const el = photoEl(slot);
    if (readOnly || !im?.src || !el) return;
    const r = el.getBoundingClientRect();
    const fw = el.offsetWidth;
    const fh = el.offsetHeight;
    const tag = el.querySelector("img");
    const iw = im.w || tag?.naturalWidth || fw;
    const ih = im.h || tag?.naturalHeight || fh;
    const cover = Math.max(fw / iw, fh / ih);
    const z = im.zoom ?? 1;
    drag.current = { slot, x0: e.clientX, y0: e.clientY, ix: im.x ?? 50, iy: im.y ?? 50, k: r.width / fw, ox: iw * cover * z - fw, oy: ih * cover * z - fh, moved: false, img: im };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function photoMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x0) / d.k;
    const dy = (e.clientY - d.y0) / d.k;
    if (!d.moved && Math.hypot(dx * d.k, dy * d.k) < 3) return;
    d.moved = true;
    const cur = getImage(slide.fields, d.slot) ?? d.img;
    onImage(d.slot, {
      ...cur,
      x: d.ox > 1 ? clamp(d.ix - (dx / d.ox) * 100, 0, 100) : cur.x,
      y: d.oy > 1 ? clamp(d.iy - (dy / d.oy) * 100, 0, 100) : cur.y,
    });
  }
  function photoUp(slot: string) {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) return;
    onSelect({ kind: "photo", slot });
    const im = getImage(slide.fields, slot);
    if (!im?.src && !readOnly && uploadMode !== "off") {
      pickSlot.current = slot;
      picker.current?.click();
    }
  }
  function photoKey(e: KeyboardEvent<HTMLButtonElement>, slot: string) {
    const im = getImage(slide.fields, slot);
    if (readOnly || !im?.src) return;
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      const [dx, dy] = moves[e.key]!;
      onImage(slot, { ...im, x: clamp((im.x ?? 50) + dx, 0, 100), y: clamp((im.y ?? 50) + dy, 0, 100) });
    } else if (e.key === "+" || e.key === "=" || e.key === "-") {
      e.preventDefault();
      onImage(slot, { ...im, zoom: clamp((im.zoom ?? 1) * (e.key === "-" ? 1 / 1.05 : 1.05), 1, 3) });
    }
  }

  async function put(slot: string, file: File | undefined) {
    if (!file) return;
    onMessage("Uploading the photo…");
    try {
      const a = await uploadImage(file, "photo", uploadMode);
      const old = getImage(latest.current.slide.fields, slot);
      latest.current.onImage(slot, { src: a.url, w: a.width, h: a.height, assetId: a.id, x: 50, y: 50, zoom: 1, alt: old?.alt });
      onMessage("Photo added. Drag it to move it; scroll on it to zoom.");
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "The upload failed. Try again.");
    }
  }

  /* ---------------- in-place text editor ---------------- */
  const ta = useRef<HTMLTextAreaElement>(null);
  const opened = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) {
      opened.current = null;
      return;
    }
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
    if (opened.current !== editing) {
      opened.current = editing;
      el.focus({ preventScroll: true });
      if (editing && Object.values(PLACEHOLDER).includes(el.value)) el.select();
      else el.setSelectionRange(el.value.length, el.value.length);
    }
  });



  const close = useCallback((returnFocus: boolean) => onEdit(null, { returnFocus }), [onEdit]);

  // Markers: one per issue path, on the first element that carries it.
  const marked = new Set<string>();
  const markers: { t: Target; issue: Issue }[] = [];
  for (const t of targets) {
    const p = targetPath(slideIndex, t.key);
    if (marked.has(p)) continue;
    const found = issues.filter((i) => i.path === p);
    if (!found.length) continue;
    marked.add(p);
    const top = found.find((i) => i.level === "error") ?? found[0]!;
    markers.push({ t, issue: top });
  }
  const issuesAt = (t: Target) => issues.filter((i) => i.path === targetPath(slideIndex, t.key));

  const isSelected = (t: Target) =>
    (selection.kind === "text" && selection.key === t.key) ||
    (selection.kind === "photo" && `photo:${selection.slot}` === t.key) ||
    (selection.kind === "partner" && `partner:${selection.i}` === t.key);

  return (
    <div ref={box} className={styles.fit}>
      <div className={styles.frame} style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}>
        <div ref={stage} className={styles.stage} onLoadCapture={() => setLoads((n) => n + 1)}>
          <PostCanvas slide={slide} format={format} scale={scale} />
        </div>
        <div
          ref={layer}
          className={`${styles.layer} ${readOnly ? styles.locked : ""}`}
          role="group"
          aria-label={`Slide ${slideIndex + 1} in ${FORMAT_LABEL[format]}. Tab through the elements; Enter edits one.`}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onSelect({ kind: "slide" });
          }}
        >
          {targets.map((t) => {
            const sel = isSelected(t);
            const found = issuesAt(t);
            const errors = found.filter((i) => i.level === "error").length;
            const cls = `${styles.target} ${styles[t.kind]} ${sel ? styles.selected : ""} ${dropSlot && t.key === `photo:${dropSlot}` ? styles.drop : ""}`;
            const style: CSSProperties = { left: t.x, top: t.y, width: t.w, height: t.h };
            const label = targetLabel(t, slide) + (found.length ? `. ${errors ? `${errors} to fix` : `${found.length} to check`}.` : "");
            if (t.kind === "photo") {
              const slot = t.key.slice(6);
              return (
                <button
                  key={t.key}
                  type="button"
                  data-key={t.key}
                  data-photo={slot}
                  className={cls}
                  style={style}
                  aria-label={label}
                  aria-pressed={sel}
                  onPointerDown={(e) => photoDown(e, slot)}
                  onPointerMove={photoMove}
                  onPointerUp={() => photoUp(slot)}
                  onPointerCancel={() => (drag.current = null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      photoUp(slot);
                    } else photoKey(e, slot);
                  }}
                  onDoubleClick={() => {
                    const el = photoEl(slot);
                    if (!readOnly && el && getImage(slide.fields, slot)?.src) onCrop(slot, { w: el.offsetWidth, h: el.offsetHeight });
                  }}
                  onDragOver={(e: DragEvent) => {
                    if (readOnly || !e.dataTransfer.types.includes("Files")) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    setDropSlot(slot);
                  }}
                  onDragLeave={() => setDropSlot(null)}
                  onDrop={(e: DragEvent) => {
                    setDropSlot(null);
                    if (readOnly || !e.dataTransfer.files[0]) return;
                    e.preventDefault();
                    onSelect({ kind: "photo", slot });
                    void put(slot, e.dataTransfer.files[0]);
                  }}
                />
              );
            }
            if (t.kind === "partner") {
              const i = Number(t.key.split(":")[1]);
              return <button key={t.key} type="button" data-key={t.key} className={cls} style={style} aria-label={label} aria-pressed={sel} onClick={() => onSelect({ kind: "partner", i })} />;
            }
            return (
              <button
                key={t.key}
                type="button"
                data-key={t.key}
                className={cls}
                style={style}
                aria-label={label}
                aria-pressed={sel}
                tabIndex={editing === t.key ? -1 : undefined}
                onClick={() => {
                  onSelect({ kind: "text", key: t.key });
                  if (!readOnly) onEdit(t.key);
                }}
              />
            );
          })}
          {markers.map(({ t, issue }) => (
            <span
              key={`m-${t.key}`}
              className={`${styles.marker} ${issue.level === "error" ? styles.markErr : styles.markWarn}`}
              style={{ left: t.x + t.w, top: t.y }}
              aria-hidden="true"
              title={issue.text}
            >
              {issueNumber(issue)}
            </span>
          ))}
          {editing && edit?.key === editing ? (
            <textarea
              ref={ta}
              className={styles.inplace}
              style={edit.style}
              value={getText(slide.fields, editing)}
              maxLength={maxLength(editing)}
              rows={1}
              spellCheck
              aria-label={`${textLabel(editing)}. ${isMultiline(editing) ? "Enter adds a line; Escape finishes." : "Enter or Escape finishes."}`}
              onChange={(e) => onText(editing, isMultiline(editing) ? e.target.value : e.target.value.replace(/\n/g, " "))}
              onKeyDown={(e) => {
                if (e.key === "Escape" || (e.key === "Enter" && (!isMultiline(editing) || e.metaKey || e.ctrlKey))) {
                  e.preventDefault();
                  e.stopPropagation();
                  close(true);
                }
              }}
              onBlur={() => close(false)}
            />
          ) : null}
        </div>
      </div>
      <input
        ref={picker}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const s = pickSlot.current;
          if (s) void put(s, e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
