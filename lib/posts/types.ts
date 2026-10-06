/** Shared shapes for a post's content. Used by the database (jsonb), the editor and the renderer. */

export type Format = "feed" | "story" | "wide";
export type TemplateKey = "event" | "speaker" | "general" | "recap" | "blank";
export type Ground = "paper" | "ink" | "gold";
export type GeneralLayout = "photo" | "grid" | "full" | "text";
export type PartnerPlace = "none" | "header" | "footer";
export type LogoTone = "original" | "white" | "black";
/** Template family: how a slide is drawn. "classic" is the original desk's ledger look. */
export type FamilyKey = "shock" | "field" | "signal" | "classic";

/** An image in a frame, cropped by focus point (x, y in %) and zoom (1 to 3). */
export interface ImageRef {
  src: string;
  x?: number;
  y?: number;
  zoom?: number;
  alt?: string;
  /** Natural size, for the "will look soft" check. */
  w?: number;
  h?: number;
  assetId?: string;
}

export interface MetaCell {
  label: string;
  value: string;
}

export interface SpeakerSlot {
  name: string;
  role: string;
  photo: ImageRef | null;
  speakerId?: string;
}

export interface PartnerLogo {
  src: string;
  name: string;
  tone: LogoTone;
  partnerId?: string;
}

export interface Stat {
  value: string;
  label: string;
}

/** Everything a template can draw. Each template reads the fields it needs and ignores the rest. */
export interface SlideFields {
  ground: Ground;
  series: string;
  kicker: string;
  headline: string;
  dek: string;
  meta: MetaCell[];
  cta: string;
  page: string;
  layout?: GeneralLayout;
  bw?: boolean;
  bleed?: boolean;
  grid?: boolean;
  header?: boolean;
  speakers?: SpeakerSlot[];
  images?: (ImageRef | null)[];
  stats?: Stat[];
  partners?: PartnerLogo[];
  partnerPlace?: PartnerPlace;
  partnerLabel?: string;
}

export interface Slide {
  id: string;
  template: TemplateKey;
  /** Missing on posts made before families existed: drawn as classic. */
  family?: FamilyKey;
  fields: SlideFields;
}

export const FAMILY_LABEL: Record<FamilyKey, string> = {
  signal: "Signal: the date leads",
  shock: "Shock: Shockers gold",
  field: "Field: grown from the words",
  classic: "Classic: ivory ledger",
};

/** Whether a family draws a template itself; otherwise the slide falls back to classic. */
export function familyDraws(family: FamilyKey, template: TemplateKey, layout?: string): boolean {
  if (family === "classic" || template === "blank") return family === "classic";
  if (template === "general") return family === "field" || layout === "text" || !layout;
  return true;
}

export interface Captions {
  linkedin: string;
  instagram: string;
  alt: string;
}

export const SIZES: Record<Format, [number, number]> = {
  feed: [1080, 1350],
  story: [1080, 1920],
  wide: [1200, 627],
};

export const FORMAT_LABEL: Record<Format, string> = {
  feed: "Feed 4:5",
  story: "Story 9:16",
  wide: "LinkedIn wide",
};

export const TEMPLATES: Record<TemplateKey, { name: string; formats: Format[] }> = {
  event: { name: "Event", formats: ["feed", "story", "wide"] },
  speaker: { name: "Speaker", formats: ["feed", "story"] },
  general: { name: "General", formats: ["feed", "story"] },
  recap: { name: "Recap", formats: ["feed", "story"] },
  blank: { name: "Blank canvas", formats: ["feed", "story", "wide"] },
};
