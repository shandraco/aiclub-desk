import type { SlideFields } from "@/lib/posts/types";

/**
 * Editable things on a slide, addressed by a key relative to the slide's fields:
 * "headline", "meta.2.value", "speakers.0.name", "stats.1.label". Photos use their slot key
 * prefixed "photo:" ("photo:speakers.0"). Pure, so it is unit-tested.
 */
export type TextKey = string;

const SINGLE: Record<string, string> = {
  series: "Series",
  kicker: "Kicker",
  headline: "Headline",
  dek: "Dek",
  cta: "Footer line",
  page: "Slide counter",
  partnerLabel: "Partner label",
};

/** The words someone types to start a field that is empty ("Add a kicker" puts this in, selected). */
export const PLACEHOLDER: Record<string, string> = {
  series: "Series",
  kicker: "Kicker",
  headline: "Headline",
  dek: "One sentence on what people get from it.",
  cta: "RSVP: link in bio",
  page: "01 / 01",
};

export function textLabel(key: TextKey): string {
  if (SINGLE[key]) return SINGLE[key]!;
  const m = /^(meta|speakers|stats)\.(\d+)\.(\w+)$/.exec(key);
  if (!m) return key;
  const n = Number(m[2]) + 1;
  if (m[1] === "meta") return m[3] === "label" ? `Data strip label ${n}` : `Data strip value ${n}`;
  if (m[1] === "speakers") return m[3] === "name" ? `Speaker ${n} name` : `Speaker ${n} title`;
  return m[3] === "value" ? `Number ${n}` : `Number ${n} label`;
}

/** Fields that keep line breaks on the graphic (CSS pre-line). Others commit on Enter. */
export function isMultiline(key: TextKey): boolean {
  return key === "headline" || key === "dek" || /^speakers\.\d+\.(name|role)$/.test(key);
}

export function maxLength(key: TextKey): number {
  if (key === "dek") return 1000;
  if (key === "headline") return 300;
  if (/\.role$/.test(key)) return 160;
  if (/^stats\.\d+\.value$/.test(key) || key === "page") return 20;
  return 80;
}

export function getText(f: SlideFields, key: TextKey): string {
  if (key in SINGLE) return String((f as unknown as Record<string, unknown>)[key] ?? "");
  const m = /^(meta|speakers|stats)\.(\d+)\.(\w+)$/.exec(key);
  if (!m) return "";
  const list = (f[m[1] as "meta" | "speakers" | "stats"] ?? []) as unknown as Record<string, unknown>[];
  return String(list[Number(m[2])]?.[m[3]!] ?? "");
}

export function setText(f: SlideFields, key: TextKey, v: string): SlideFields {
  if (key in SINGLE) return { ...f, [key]: v };
  const m = /^(meta|speakers|stats)\.(\d+)\.(\w+)$/.exec(key);
  if (!m) return f;
  const name = m[1] as "meta" | "speakers" | "stats";
  const i = Number(m[2]);
  const list = [...((f[name] ?? []) as unknown as Record<string, unknown>[])];
  if (!list[i]) return f;
  list[i] = { ...list[i], [m[3]!]: v };
  return { ...f, [name]: list };
}

/** Text a template draws, so the inspector can offer "Add a …" for the ones that are empty. */
export function textsFor(template: string): TextKey[] {
  if (template === "blank") return ["series", "cta", "page"];
  const base = ["series", "kicker", "headline"];
  if (template === "event" || template === "general") base.push("dek");
  return [...base, "cta", "page"];
}

export type Focus = { slide: number; text?: TextKey; photo?: string; partner?: number; pane?: "captions"; field?: string };

/**
 * Where a brand-check issue lives: "slides.1.meta.0" is the value of data cell 1 on slide 2;
 * "slides.0.speakers.1.photo" is a photo; "captions.alt" is in the captions pane.
 */
export function issueTarget(path: string): Focus | null {
  if (path.startsWith("captions.")) return { slide: -1, pane: "captions", field: path };
  const m = /^slides\.(\d+)(?:\.(.+))?$/.exec(path);
  if (!m) return null;
  const slide = Number(m[1]);
  const rest = m[2] ?? "";
  let r: RegExpExecArray | null;
  if ((r = /^speakers\.(\d+)\.photo$/.exec(rest))) return { slide, photo: `speakers.${r[1]}` };
  if ((r = /^images\.(\d+)$/.exec(rest))) return { slide, photo: `images.${r[1]}` };
  if ((r = /^partners\.(\d+)/.exec(rest))) return { slide, partner: Number(r[1]) };
  if ((r = /^meta\.(\d+)$/.exec(rest))) return { slide, text: `meta.${r[1]}.value` };
  if (rest === "stats") return { slide, text: "stats.0.value" };
  if (rest) return { slide, text: rest };
  return { slide };
}

/** The issue path a canvas target reports under, for markers next to elements. */
export function targetPath(slide: number, key: string): string {
  if (key.startsWith("photo:")) {
    const slot = key.slice(6);
    return slot.startsWith("speakers.") ? `slides.${slide}.${slot}.photo` : `slides.${slide}.${slot}`;
  }
  const meta = /^meta\.(\d+)\.\w+$/.exec(key);
  if (meta) return `slides.${slide}.meta.${meta[1]}`;
  if (/^stats\./.test(key)) return `slides.${slide}.stats`;
  return `slides.${slide}.${key}`;
}
