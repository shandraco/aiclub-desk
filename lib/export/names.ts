import type { Captions, Format, Slide } from "@/lib/posts/types";

/** File names and the captions file for an export. Pure, so it is unit-tested. */

export function slugify(text: string, fallback = "post"): string {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return s || fallback;
}

/** The slug for a post: its cover headline, else its series line. */
export function postSlug(slides: Slide[]): string {
  const f = slides[0]?.fields;
  return slugify(f?.headline || f?.series || "");
}

/** aiclub-<slug>-<format>-<nn>.png, nn counting slides from 01. */
export function pngName(slug: string, format: Format, slideIndex: number): string {
  return `aiclub-${slug}-${format}-${String(slideIndex + 1).padStart(2, "0")}.png`;
}

export function captionsText(c: Captions): string {
  const block = (title: string, body: string) => `${title}\n${"-".repeat(title.length)}\n${body.trim() || "(empty)"}\n`;
  return [block("LinkedIn", c.linkedin), block("Instagram", c.instagram), block("Alt text", c.alt)].join("\n");
}

/** Every slide in every chosen format its template supports, in slide order. */
export function exportJobs(slides: Slide[], formats: Format[], supported: (s: Slide) => Format[]): { slide: Slide; index: number; format: Format }[] {
  const out: { slide: Slide; index: number; format: Format }[] = [];
  for (const format of formats) {
    slides.forEach((slide, index) => {
      if (supported(slide).includes(format)) out.push({ slide, index, format });
    });
  }
  return out;
}
