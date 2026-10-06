"use client";

import type { ReactNode } from "react";
import { ImageDrop } from "@/components/upload/ImageDrop";
import type { Issue } from "@/lib/brand/checks";
import type { ImageRef } from "@/lib/posts/types";
import { fid, IssueList, Range } from "./fields";
import { SOFT_LIMIT, softness } from "./slots";
import type { UploadMode } from "./types";
import styles from "./editor.module.css";

/**
 * One photo in the form: upload or replace, focus point and zoom as ranges (the keyboard
 * alternative to dragging in the preview), the crop dialog, and what size the frame needs.
 */
export function PhotoField({
  label,
  path,
  img,
  onChange,
  uploadMode,
  frame,
  formatName,
  onCrop,
  issues = [],
  extra,
}: {
  label: string;
  path: string;
  img: ImageRef | null | undefined;
  onChange: (img: ImageRef | null) => void;
  uploadMode: UploadMode;
  frame?: { w: number; h: number };
  formatName: string;
  onCrop: () => void;
  issues?: Issue[];
  extra?: ReactNode;
}) {
  const id = fid(path);
  const soft = softness(img, frame);
  const set = (patch: Partial<ImageRef>) => img && onChange({ ...img, ...patch });
  return (
    <div className={styles.photo} data-path={path} tabIndex={-1} aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="visually-hidden">{label}</span>
      <ImageDrop
        kind="photo"
        mode={uploadMode}
        compact
        label={label}
        current={img?.src ?? null}
        onUploaded={(a) => onChange({ src: a.url, w: a.width, h: a.height, assetId: a.id, x: 50, y: 50, zoom: 1, alt: img?.alt })}
      />
      {extra}
      {img?.src ? (
        <>
          <div className={styles.ranges}>
            <Range label="Across" id={`${id}-x`} value={img.x ?? 50} min={0} max={100} step={1} onChange={(x) => set({ x })} format={(v) => `${Math.round(v)}%`} />
            <Range label="Down" id={`${id}-y`} value={img.y ?? 50} min={0} max={100} step={1} onChange={(y) => set({ y })} format={(v) => `${Math.round(v)}%`} />
            <Range label="Zoom" id={`${id}-zoom`} value={img.zoom ?? 1} min={1} max={3} step={0.01} onChange={(zoom) => set({ zoom })} format={(v) => `${v.toFixed(2)}×`} />
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-s" onClick={onCrop} disabled={!frame}>
              Crop…
            </button>
            <button type="button" className="btn btn-s" onClick={() => set({ x: 50, y: 50, zoom: 1 })}>
              Reset framing
            </button>
            <button type="button" className="btn btn-s btn-danger" onClick={() => onChange(null)}>
              Remove photo
            </button>
          </div>
        </>
      ) : null}
      {frame ? (
        <p className={`${styles.hint} ${soft > SOFT_LIMIT ? styles.warnText : ""}`}>
          Frame {frame.w} × {frame.h} px in {formatName}. Best {frame.w * 2} × {frame.h * 2} or larger.
          {img?.w && img.h ? ` Yours ${img.w} × ${img.h}${soft > SOFT_LIMIT ? ", too small at this zoom: it will look soft." : "."}` : ""}
        </p>
      ) : null}
      <IssueList issues={issues} />
    </div>
  );
}
