"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ImageRef } from "@/lib/posts/types";
import { boxFromFocus, focusFromBox, geom, moveBox, resizeBox, type Box } from "./crop";
import { Range } from "./fields";
import { clamp } from "./slots";
import styles from "./editor.module.css";

export interface CropTarget {
  key: string;
  label: string;
  frame: { w: number; h: number };
  formatName: string;
}

/**
 * The crop tool. The whole photo is shown with a box in the frame's shape: drag the box to
 * move it, drag a corner to crop tighter or looser. Arrow keys move it, + and - zoom, and the
 * ranges below do the same for anyone not using a pointer. Changes apply live.
 */
export function CropDialog({ target, img, onChange, onClose }: { target: CropTarget | null; img: ImageRef | null; onChange: (img: ImageRef) => void; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ corner: string | null; x0: number; y0: number; start: Box; rx: number; ry: number } | null>(null);
  const open = !!target && !!img?.src;

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const src = img?.src;
  useEffect(() => {
    if (!src) return;
    let live = true;
    const probe = new Image();
    probe.onload = () => live && setNatural({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.src = src;
    return () => {
      live = false;
    };
  }, [src]);

  const iw = img?.w || natural?.w || 0;
  const ih = img?.h || natural?.h || 0;
  const ready = open && iw > 0 && ih > 0;
  const g = ready ? geom(target!.frame, iw, ih) : null;
  const box = g && img ? boxFromFocus(g, img) : null;
  const maxW = typeof window === "undefined" ? 640 : Math.min(640, window.innerWidth - 96);
  const maxH = typeof window === "undefined" ? 420 : Math.max(240, window.innerHeight - 380);
  const d = ready ? Math.min(maxW / iw, maxH / ih) : 1;

  function apply(b: Box) {
    if (!g || !img) return;
    const f = focusFromBox(g, b);
    onChange({ ...img, x: Math.round(f.x * 10) / 10, y: Math.round(f.y * 10) / 10, zoom: Math.round(f.zoom * 100) / 100 });
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (!box || !area.current) return;
    const t = e.target as HTMLElement;
    const corner = t.dataset.corner ?? null;
    if (!corner && !t.closest("[data-box]")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = area.current.getBoundingClientRect();
    drag.current = { corner, x0: e.clientX, y0: e.clientY, start: box, rx: r.left, ry: r.top };
  }

  function moveP(e: PointerEvent<HTMLDivElement>) {
    const s = drag.current;
    if (!s || !g) return;
    if (!s.corner) apply(moveBox(g, s.start, (e.clientX - s.x0) / d, (e.clientY - s.y0) / d));
    else apply(resizeBox(g, s.start, s.corner, (e.clientX - s.rx) / d, (e.clientY - s.ry) / d));
  }

  function key(e: KeyboardEvent<HTMLDivElement>) {
    if (!g || !box || !img) return;
    const step = (e.shiftKey ? 0.1 : 0.02) * Math.min(iw, ih);
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      apply(moveBox(g, box, ...moves[e.key]!));
    } else if (e.key === "+" || e.key === "=" || e.key === "-") {
      e.preventDefault();
      onChange({ ...img, zoom: clamp((img.zoom ?? 1) * (e.key === "-" ? 1 / 1.05 : 1.05), 1, 3) });
    }
  }

  const px = (b: Box) => ({ left: b.l * d, top: b.t * d, width: b.w * d, height: b.h * d });

  return (
    <dialog ref={dlg} className={`dlg ${styles.cropDlg}`} aria-labelledby="crop-title" onClose={onClose} onCancel={onClose}>
      <h2 id="crop-title">Crop {target?.label.toLowerCase() ?? "photo"}</h2>
      <p className={styles.hint}>
        Drag the box to move it; drag a corner to crop tighter or looser. With the keyboard: arrow keys move it, plus and minus zoom.
        {target ? ` The box keeps the frame’s shape, ${target.frame.w} × ${target.frame.h} px in ${target.formatName}.` : ""}
      </p>
      {ready && box && img ? (
        <>
          {/* The area only routes drags to the box below. The box is a 2D control: arrow keys move it, plus and minus zoom. */}
          {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div ref={area} className={styles.cropArea} style={{ width: Math.round(iw * d), height: Math.round(ih * d) }} onPointerDown={down} onPointerMove={moveP} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt="" draggable={false} />
            <div
              className={styles.cropBox}
              style={px(box)}
              data-box
              tabIndex={0}
              role="group"
              aria-label={`Crop box. Across ${Math.round(img.x ?? 50)}%, down ${Math.round(img.y ?? 50)}%, zoom ${(img.zoom ?? 1).toFixed(2)}×. Arrow keys move it.`}
              onKeyDown={key}
            >
              {["tl", "tr", "bl", "br"].map((c) => (
                <span key={c} className={styles.cropHandle} data-corner={c} data-pos={c} aria-hidden="true" />
              ))}
            </div>
          </div>
          {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div className={styles.ranges}>
            <Range label="Across" id="crop-x" value={img.x ?? 50} min={0} max={100} step={1} onChange={(x) => onChange({ ...img, x })} format={(v) => `${Math.round(v)}%`} />
            <Range label="Down" id="crop-y" value={img.y ?? 50} min={0} max={100} step={1} onChange={(y) => onChange({ ...img, y })} format={(v) => `${Math.round(v)}%`} />
            <Range label="Zoom" id="crop-zoom" value={img.zoom ?? 1} min={1} max={3} step={0.01} onChange={(zoom) => onChange({ ...img, zoom })} format={(v) => `${v.toFixed(2)}×`} />
          </div>
        </>
      ) : (
        <p className="muted">Loading the photo…</p>
      )}
      <div className={`btn-row ${styles.dlgActions}`}>
        <button type="button" className="btn btn-primary" onClick={() => dlg.current?.close()}>
          Done
        </button>
        <button type="button" className="btn" onClick={() => img && onChange({ ...img, x: 50, y: 50, zoom: 1 })}>
          Reset
        </button>
      </div>
    </dialog>
  );
}
