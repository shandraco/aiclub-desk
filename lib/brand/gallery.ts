import { blankFields, presetByKey } from "@/lib/brand/presets";
import type { FamilyKey, Format, GeneralLayout, Ground, ImageRef, Slide, SlideFields, TemplateKey } from "@/lib/posts/types";
import { TEMPLATES } from "@/lib/posts/types";

/**
 * The template gallery: every design an officer can start a post from. Each entry is a family
 * (how it is drawn) plus a template (what it holds) plus defaults. `sample` fills it with
 * clearly fictional words for the preview only; `start` gives the empty version a new post
 * begins from, so placeholder words never end up in a real post.
 */

export type GalleryType = "announcement" | "speaker" | "photos" | "news" | "recap" | "canvas";

export const TYPE_LABEL: Record<GalleryType, string> = {
  announcement: "Announcements",
  speaker: "Speakers and panels",
  photos: "Photos",
  news: "News and questions",
  recap: "Recaps",
  canvas: "Blank canvas",
};

export interface GalleryEntry {
  id: string;
  name: string;
  use: string;
  family: FamilyKey;
  template: TemplateKey;
  type: GalleryType;
  /** Series preset for defaults (data strip labels, call to action) and the post's preset. */
  preset: string;
  ground: Ground;
  layout?: GeneralLayout;
  /** Speaker slots to start with. */
  speakers?: number;
  /** Photo slots to start with (grid layouts). */
  photos?: number;
  kind: "custom" | "photos" | "recap";
}

export const GALLERY: GalleryEntry[] = [
  { id: "signal-workshop", name: "Date poster", use: "Workshops and anything people come to. The date is the first thing anyone sees.", family: "signal", template: "event", type: "announcement", preset: "workshop", ground: "ink", kind: "custom" },
  { id: "signal-gold", name: "Date poster, gold", use: "Build nights and big moments. Shockers gold, the date as a giant numeral.", family: "signal", template: "event", type: "announcement", preset: "build", ground: "gold", kind: "custom" },
  { id: "signal-ivory", name: "Date poster, ivory", use: "A quieter date poster for talks and socials.", family: "signal", template: "event", type: "announcement", preset: "workshop", ground: "paper", kind: "custom" },
  { id: "shock-announce", name: "Shock column", use: "Announcements that should be loud: the logo’s wheat column rising off the edge.", family: "shock", template: "event", type: "announcement", preset: "partner", ground: "gold", kind: "custom" },
  { id: "shock-announce-ink", name: "Shock column, black", use: "The same column in gold on black.", family: "shock", template: "event", type: "announcement", preset: "workshop", ground: "ink", kind: "custom" },
  { id: "field-announce", name: "Field announcement", use: "A wheat field grown from the post’s words. Every one is different.", family: "field", template: "event", type: "announcement", preset: "workshop", ground: "ink", kind: "custom" },
  { id: "shock-speaker", name: "Speaker spotlight", use: "One guest, in a gold duotone portrait, with their talk title.", family: "shock", template: "speaker", type: "speaker", preset: "speaker-series", ground: "ink", speakers: 1, kind: "custom" },
  { id: "shock-panel", name: "Panel", use: "Two to four speakers side by side.", family: "shock", template: "speaker", type: "speaker", preset: "panel", ground: "ink", speakers: 3, kind: "custom" },
  { id: "signal-speaker", name: "Speaker poster", use: "A black-and-white portrait with a chevron notch and the date bar.", family: "signal", template: "speaker", type: "speaker", preset: "speaker-series", ground: "paper", speakers: 1, kind: "custom" },
  { id: "field-speaker", name: "Speaker in the field", use: "The portrait in the logo’s “i” stem, over a wheat field.", family: "field", template: "speaker", type: "speaker", preset: "workflow", ground: "ink", speakers: 1, kind: "custom" },
  { id: "field-photo", name: "One photo", use: "A single picture from a session, with a line about it.", family: "field", template: "general", type: "photos", preset: "photos", ground: "ink", layout: "photo", kind: "photos" },
  { id: "field-grid", name: "Photo grid", use: "Two to four pictures from the same night.", family: "field", template: "general", type: "photos", preset: "photos", ground: "ink", layout: "grid", photos: 3, kind: "photos" },
  { id: "field-full", name: "Full-bleed photo", use: "One strong picture edge to edge, words over the bottom.", family: "field", template: "general", type: "photos", preset: "photos", ground: "ink", layout: "full", kind: "photos" },
  { id: "field-news", name: "Club news", use: "Recruiting, elections, announcements: words only, over a wheat field.", family: "field", template: "general", type: "news", preset: "news", ground: "ink", layout: "text", kind: "custom" },
  { id: "field-news-ivory", name: "Club news, ivory", use: "The same, on ivory.", family: "field", template: "general", type: "news", preset: "news", ground: "paper", layout: "text", kind: "custom" },
  { id: "signal-question", name: "Open question", use: "Open Floor topics and polls: a big question, both sides welcome.", family: "signal", template: "general", type: "news", preset: "open-floor", ground: "gold", layout: "text", kind: "custom" },
  { id: "field-recap", name: "Field recap", use: "Two to four real numbers after an event, in gold over the field.", family: "field", template: "recap", type: "recap", preset: "recap", ground: "ink", kind: "recap" },
  { id: "shock-recap", name: "Scoreboard recap", use: "The numbers huge, beside the wheat column.", family: "shock", template: "recap", type: "recap", preset: "recap", ground: "gold", kind: "recap" },
  { id: "signal-recap", name: "Poster recap", use: "Numbers as giant poster numerals with chevrons.", family: "signal", template: "recap", type: "recap", preset: "recap", ground: "ink", kind: "recap" },
  { id: "classic-event", name: "Classic event", use: "The original desk’s ivory ledger look.", family: "classic", template: "event", type: "announcement", preset: "workshop", ground: "paper", kind: "custom" },
  { id: "classic-blank", name: "Blank canvas", use: "Ground, grid and logo only. Export it and finish it in Canva.", family: "classic", template: "blank", type: "canvas", preset: "blank", ground: "paper", kind: "custom" },
];

export const galleryEntry = (id: string) => GALLERY.find((g) => g.id === id) ?? null;
export const formatsFor = (g: GalleryEntry): Format[] => TEMPLATES[g.template].formats;

/** The empty slide a new post starts from: structure and labels, no placeholder words. */
export function startSlide(g: GalleryEntry, words: { headline?: string; series?: string } = {}): Slide {
  const preset = presetByKey(g.preset);
  const f: SlideFields = blankFields(g.template, preset);
  f.ground = g.ground;
  if (g.layout) f.layout = g.layout;
  if (g.speakers) f.speakers = Array.from({ length: g.speakers }, () => ({ name: "", role: "", photo: null }));
  if (g.photos) f.images = Array.from({ length: g.photos }, () => null);
  if (g.layout && g.layout !== "grid") f.images = [null];
  if (g.template === "general" && g.layout === "text") f.meta = [];
  if (words.headline !== undefined) f.headline = words.headline;
  if (words.series !== undefined) f.series = words.series;
  return { id: Math.random().toString(36).slice(2, 10), template: g.template, family: g.family, fields: f };
}

/* ---------- preview content: obviously sample, never saved ---------- */

const PORTRAIT: ImageRef = { src: "/brand/sample-portrait.svg", x: 50, y: 40, zoom: 1, alt: "Stand-in portrait" };
const PHOTO: ImageRef = { src: "/brand/sample-photo.svg", x: 50, y: 50, zoom: 1, alt: "Stand-in photo" };

export function sampleSlide(g: GalleryEntry): Slide {
  const s = startSlide(g);
  const f = s.fields;
  const strip = [
    { label: "Date", value: "Thu, Oct 15" },
    { label: "Time", value: "5 to 6:30 PM" },
    { label: "Room", value: "Ablah 310" },
  ];
  if (g.type === "announcement") {
    Object.assign(f, {
      series: g.preset === "build" ? "Build night 02" : g.preset === "partner" ? "Partner event" : "Workshop 03",
      kicker: "No experience needed",
      headline: g.preset === "build" ? "Ship something by midnight" : "Build a study bot in an hour",
      dek: "Bring a laptop. We start from a blank notebook and finish with a bot that answers questions about your own notes.",
      meta: strip,
      cta: "RSVP: link in bio",
    });
  }
  if (g.type === "speaker") {
    const names = [
      ["Jordan Lee", "Data lead, Textron Aviation"],
      ["Ana Ruiz", "Recruiter, Koch"],
      ["Sam Okafor", "SWE, Garmin"],
      ["Lee Park", "Professor, WSU"],
    ];
    Object.assign(f, {
      series: g.speakers && g.speakers > 1 ? "Panel 01" : "Speaker series 02",
      kicker: g.speakers && g.speakers > 1 ? "" : "Textron Aviation",
      headline: g.speakers && g.speakers > 1 ? "Who gets hired when AI writes the code" : "How a flight-test team reads 4 TB a day",
      speakers: (f.speakers ?? []).map((_, i) => ({ name: names[i]![0]!, role: names[i]![1]!, photo: PORTRAIT })),
      meta: [{ label: "Date", value: "Thu, Oct 23" }, { label: "Time", value: "5:30 PM" }, { label: "Room", value: "Woolsey 101" }],
      cta: "RSVP: link in bio",
    });
  }
  if (g.type === "photos") {
    Object.assign(f, {
      series: "From the session",
      kicker: "Hack night 02",
      headline: g.layout === "full" ? "64 builders, one long night" : "What we built on Friday",
      dek: "Fourteen projects shipped before midnight. Thanks to everyone who stayed.",
      images: (f.images ?? [null]).map(() => PHOTO),
      cta: "",
    });
  }
  if (g.type === "news") {
    Object.assign(f, {
      series: g.preset === "open-floor" ? "Open floor 01" : "Club news",
      kicker: g.preset === "open-floor" ? "Both sides, fairly" : "Applications open",
      headline: g.preset === "open-floor" ? "Should Wichita want a data center?" : "We’re electing new officers",
      dek: g.preset === "open-floor" ? "Two students, two sides, one hour. Then it’s your turn." : "Five roles, one week to apply. Every major welcome.",
      meta: g.preset === "open-floor" ? strip : [],
      cta: g.preset === "open-floor" ? "Bring your questions" : "Apply: link in bio",
    });
  }
  if (g.type === "recap") {
    Object.assign(f, {
      series: "Recap, hack night 02",
      headline: "Hack night 02 in numbers",
      stats: [
        { value: "64", label: "Builders" },
        { value: "14", label: "Projects shipped" },
        { value: "9", label: "Majors" },
        { value: "3", label: "Sponsors" },
      ],
      cta: "Thanks for building with us",
    });
  }
  if (g.type === "canvas") Object.assign(f, { series: "", cta: "", page: "" });
  return s;
}
