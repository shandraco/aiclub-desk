import { z } from "zod";

/**
 * Input shapes for the posts area's server actions. Content comes from the browser, so every
 * string is bounded and every image URL must point at this desk's own storage.
 */

/** Our images only: local dev uploads, the brand folder, or this project's Vercel Blob store. */
export function isOurImage(src: string): boolean {
  if (src.includes("..")) return false;
  if (/^\/(uploads|brand)\/[\w./-]+$/.test(src)) return true;
  return /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[\w./%-]+$/i.test(src);
}

const s = (max: number) => z.string().max(max);
const pct = z.number().min(0).max(100);

export const ImageSchema = z.object({
  src: s(600).refine(isOurImage, "Images must be uploaded to the desk."),
  x: pct.optional(),
  y: pct.optional(),
  zoom: z.number().min(1).max(3).optional(),
  alt: s(400).optional(),
  w: z.number().int().min(1).max(20000).optional(),
  h: z.number().int().min(1).max(20000).optional(),
  assetId: z.uuid().optional(),
});

const Fields = z.object({
  ground: z.enum(["paper", "ink", "gold"]),
  series: s(80),
  kicker: s(80),
  headline: s(300),
  dek: s(1000),
  meta: z.array(z.object({ label: s(40), value: s(80) })).max(4),
  cta: s(80),
  page: s(20),
  layout: z.enum(["photo", "grid", "full", "text"]).optional(),
  bw: z.boolean().optional(),
  bleed: z.boolean().optional(),
  grid: z.boolean().optional(),
  header: z.boolean().optional(),
  speakers: z
    .array(z.object({ name: s(100), role: s(160), photo: ImageSchema.nullable(), speakerId: z.uuid().optional() }))
    .max(4)
    .optional(),
  images: z.array(ImageSchema.nullable()).max(4).optional(),
  stats: z.array(z.object({ value: s(20), label: s(60) })).max(4).optional(),
  partners: z
    .array(z.object({ src: s(600).refine((v) => v === "" || isOurImage(v), "Logos must be uploaded to the desk."), name: s(100), tone: z.enum(["original", "white", "black"]), partnerId: z.uuid().optional() }))
    .max(3)
    .optional(),
  partnerPlace: z.enum(["none", "header", "footer"]).optional(),
  partnerLabel: s(60).optional(),
});

export const SlideSchema = z.object({
  id: s(40).min(1),
  template: z.enum(["event", "speaker", "general", "recap", "blank"]),
  family: z.enum(["shock", "field", "signal", "classic"]).optional(),
  fields: Fields,
});

export const CaptionsSchema = z.object({ linkedin: s(5000), instagram: s(5000), alt: s(1500) });

export const KINDS = ["announce", "linkedin", "reminder", "day_of", "recap", "photos", "custom"] as const;
export const FORMATS = ["feed", "story", "wide"] as const;
export const CHANNELS = ["instagram", "linkedin", "story"] as const;

export const SaveSchema = z.object({
  postId: z.uuid(),
  version: z.number().int().min(1),
  patch: z.object({
    slides: z.array(SlideSchema).min(1).max(10),
    captions: CaptionsSchema,
    formats: z.array(z.enum(FORMATS)).max(3),
    channels: z.array(z.enum(CHANNELS)).max(3),
    /** ISO instant, or null for unscheduled. */
    scheduledFor: z.iso.datetime().nullable(),
    kind: z.enum(KINDS),
  }),
});
export type SaveInput = z.input<typeof SaveSchema>;
