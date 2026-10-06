import type { ImageRef, SlideFields } from "@/lib/posts/types";

/**
 * Photo slots in a slide, addressed the way PostCanvas marks them with data-slot:
 * "speakers.0" is the first speaker's photo, "images.2" the third general photo.
 * Pure helpers, shared by the preview (drag, zoom, drop), the form and the checks.
 */
export type SlotKey = string;

export function parseSlot(key: SlotKey): { list: "speakers" | "images"; i: number } | null {
  const m = /^(speakers|images)\.(\d+)$/.exec(key);
  return m ? { list: m[1] as "speakers" | "images", i: Number(m[2]) } : null;
}

export function getImage(f: SlideFields, key: SlotKey): ImageRef | null {
  const s = parseSlot(key);
  if (!s) return null;
  if (s.list === "speakers") return f.speakers?.[s.i]?.photo ?? null;
  return f.images?.[s.i] ?? null;
}

/** Returns new fields with the image in that slot replaced (or cleared with null). */
export function setImage(f: SlideFields, key: SlotKey, img: ImageRef | null): SlideFields {
  const s = parseSlot(key);
  if (!s) return f;
  if (s.list === "speakers") {
    const speakers = [...(f.speakers ?? [])];
    const cur = speakers[s.i];
    if (!cur) return f;
    speakers[s.i] = { ...cur, photo: img };
    return { ...f, speakers };
  }
  const images = [...(f.images ?? [])];
  while (images.length <= s.i) images.push(null);
  images[s.i] = img;
  return { ...f, images };
}

/** The checks' field path for a slot: speakers use ".photo", images use the slot itself. */
export function slotPath(slide: number, key: SlotKey): string {
  const s = parseSlot(key);
  if (!s) return `slides.${slide}`;
  return s.list === "speakers" ? `slides.${slide}.speakers.${s.i}.photo` : `slides.${slide}.images.${s.i}`;
}

/**
 * How much the photo is enlarged to fill its frame (1 = one image pixel per canvas pixel).
 * Above about 1.15 a photo looks soft in the export. 0 when the size is unknown.
 */
export function softness(img: Pick<ImageRef, "w" | "h" | "zoom"> | null | undefined, frame: { w: number; h: number } | undefined): number {
  if (!img?.w || !img.h || !frame?.w || !frame.h) return 0;
  return Math.max(frame.w / img.w, frame.h / img.h) * Math.max(1, img.zoom ?? 1);
}

export const SOFT_LIMIT = 1.15;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
