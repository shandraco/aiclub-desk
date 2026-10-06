"use client";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { FormMessage, TextArea, TextField } from "@/components/forms/Field";
import { Photo } from "@/components/post/PostCanvas";
import { PostThumb } from "@/components/post/PostThumb";
import { ImageDrop } from "@/components/upload/ImageDrop";
import type { FormState } from "@/lib/actions";
import type { Slide } from "@/lib/posts/types";
import { Dialog } from "@/lib/team/ui/Dialog";
import { saveSpeaker } from "../actions";
import styles from "../library.module.css";

export interface SpeakerDraft {
  id: string;
  name: string;
  role: string;
  instagram: string;
  linkedin: string;
  notes: string;
  photo: { id: string; url: string; width: number; height: number } | null;
  crop: { x: number; y: number; zoom: number };
}

type Mode = "blob" | "dev" | "off";

export function SpeakerEditButton({ speaker, mode }: { speaker?: SpeakerDraft; mode: Mode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={speaker ? "btn btn-s" : "btn btn-primary"}
        onClick={() => setOpen(true)}
        aria-label={speaker ? `Edit ${speaker.name}` : undefined}
      >
        {speaker ? "Edit" : "Add speaker"}
      </button>
      {open ? (
        <Dialog title={speaker ? `Edit ${speaker.name}` : "Add a speaker"} onClose={() => setOpen(false)} wide>
          <SpeakerForm speaker={speaker} mode={mode} onDone={() => setOpen(false)} />
        </Dialog>
      ) : null}
    </>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function SpeakerForm({ speaker, mode, onDone }: { speaker?: SpeakerDraft; mode: Mode; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSpeaker, {});
  const v = state.values;
  const [photo, setPhoto] = useState(speaker?.photo ?? null);
  const [crop, setCrop] = useState(speaker?.crop ?? { x: 50, y: 50, zoom: 1 });
  const [name, setName] = useState(v?.name ?? speaker?.name ?? "");
  const [role, setRole] = useState(v?.role ?? speaker?.role ?? "");

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  const img = photo ? { src: photo.url, x: crop.x, y: crop.y, zoom: crop.zoom } : null;
  const slide: Slide = {
    id: "preview",
    template: "speaker",
    fields: {
      ground: "paper",
      series: "Speaker series",
      kicker: "",
      headline: "",
      dek: "",
      meta: [],
      cta: "",
      page: "",
      bw: true,
      speakers: [{ name: name || "Speaker name", role, photo: img }],
    },
  };

  return (
    <form action={action} noValidate className={styles.editor}>
      {speaker ? <input type="hidden" name="id" value={speaker.id} /> : null}
      <input type="hidden" name="photoId" value={photo?.id ?? ""} />
      <input type="hidden" name="cropX" value={crop.x} />
      <input type="hidden" name="cropY" value={crop.y} />
      <input type="hidden" name="cropZoom" value={crop.zoom} />

      <div className={styles.editorFields}>
        <TextField label="Name" name="name" required data-autofocus value={name} onChange={(e) => setName(e.target.value)} error={state.errors?.name} autoComplete="off" />
        <TextField
          label="Title and organisation"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          hint="As it appears under the photo: “Data lead · Textron Aviation”."
          error={state.errors?.role}
          autoComplete="off"
        />
        <div className="grid-2">
          <TextField
            label="Instagram"
            name="instagram"
            defaultValue={v?.instagram ?? (speaker?.instagram ? `@${speaker.instagram}` : "")}
            hint="@handle or profile link, for tagging."
            error={state.errors?.instagram}
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
          />
          <TextField
            label="LinkedIn"
            name="linkedin"
            defaultValue={v?.linkedin ?? speaker?.linkedin ?? ""}
            hint="Profile link, like linkedin.com/in/name."
            error={state.errors?.linkedin}
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <TextArea
          label="Notes"
          name="notes"
          rows={3}
          defaultValue={v?.notes ?? speaker?.notes ?? ""}
          hint="Where the photo came from and who approved it: “Approved photo 2026-09 via email”."
          error={state.errors?.notes}
        />
      </div>

      <div className={styles.editorPhoto}>
        <ImageDrop
          kind="photo"
          mode={mode}
          label="Photo"
          current={photo?.url}
          onUploaded={(a) => {
            setPhoto(a);
            setCrop({ x: 50, y: 40, zoom: 1 });
          }}
        />
        {photo ? (
          <>
            <FocusPicker url={photo.url} crop={crop} onChange={setCrop} />
            <div className="field">
              <label htmlFor="speaker-zoom">Zoom <span className="figures muted">{crop.zoom.toFixed(2)}×</span></label>
              <input
                id="speaker-zoom"
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={crop.zoom}
                onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))}
                className={styles.range}
              />
            </div>
            {photo.width > 0 && photo.width < 800 ? (
              <p className="notice notice-spark">This photo is {photo.width}px wide. It will look soft on a graphic; ask the speaker for a larger one.</p>
            ) : null}
          </>
        ) : (
          <p className="hint">A head-and-shoulders photo works best. It is shown in black and white on every graphic.</p>
        )}
        <div className={styles.previews}>
          <figure>
            <div className={styles.square}>
              <Photo img={img} slot="preview" bw label="No photo" alt="" />
            </div>
            <figcaption>Square crop</figcaption>
          </figure>
          <figure>
            <PostThumb slide={slide} width={150} />
            <figcaption>On a speaker post</figcaption>
          </figure>
        </div>
      </div>

      <div className={styles.editorFoot}>
        <FormMessage message={state.ok ? undefined : state.message} />
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : speaker ? "Save changes" : "Add speaker"}
          </button>
          <button type="button" className="btn" onClick={onDone}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * The whole photo, with a marker on the focus point. Click to move it; arrow keys move it
 * by 2% (10% with Shift). The crop keeps the focus point in view at every size.
 */
function FocusPicker({ url, crop, onChange }: { url: string; crop: { x: number; y: number; zoom: number }; onChange: (c: { x: number; y: number; zoom: number }) => void }) {
  const box = useRef<HTMLButtonElement>(null);

  function click(e: MouseEvent<HTMLButtonElement>) {
    const r = box.current!.getBoundingClientRect();
    onChange({ ...crop, x: round1(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)), y: round1(clamp(((e.clientY - r.top) / r.height) * 100, 0, 100)) });
  }
  function key(e: KeyboardEvent<HTMLButtonElement>) {
    const step = e.shiftKey ? 10 : 2;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    onChange({ ...crop, x: round1(clamp(crop.x + d[0]!, 0, 100)), y: round1(clamp(crop.y + d[1]!, 0, 100)) });
  }

  return (
    <div className="field">
      <span className="label" id="focus-label">Focus point</span>
      <button
        ref={box}
        type="button"
        className={styles.focus}
        aria-labelledby="focus-label"
        aria-describedby="focus-hint"
        onClick={click}
        onKeyDown={key}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" draggable={false} />
        <span className={styles.marker} style={{ left: `${crop.x}%`, top: `${crop.y}%` }} aria-hidden="true" />
      </button>
      <span id="focus-hint" className="hint" aria-live="polite">
        Click the face, or use the arrow keys. Now {Math.round(crop.x)}% across, {Math.round(crop.y)}% down.
      </span>
    </div>
  );
}
