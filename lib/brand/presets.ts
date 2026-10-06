import type { FamilyKey, Format, Ground, SlideFields, TemplateKey } from "@/lib/posts/types";

/**
 * The club's series. Each sets the template, the ground and the data strip a new post starts
 * from. Names, descriptions and defaults are carried over from the original content desk.
 */
export interface Preset {
  key: string;
  name: string;
  description: string;
  template: TemplateKey;
  /** True when the series is an event people attend; those get a post plan. */
  isEvent: boolean;
  /** The template family the series is drawn in, so each series is recognisable in a feed. */
  family: FamilyKey;
  fields: Partial<SlideFields> & { ground: Ground };
}

const M = (...labels: string[]) => labels.map((label) => ({ label, value: "" }));

export const PRESETS: Preset[] = [
  {
    key: "speaker-series",
    family: "shock",
    name: "Speaker Series",
    description: "Industry experts. Ivory, 1 to 4 speakers.",
    template: "speaker",
    isEvent: true,
    fields: { ground: "paper", series: "Speaker series · 01", meta: M("Date", "Time", "Room"), cta: "RSVP: link in bio" },
  },
  {
    key: "panel",
    family: "shock",
    name: "Panel",
    description: "Several speakers on one stage.",
    template: "speaker",
    isEvent: true,
    fields: { ground: "paper", series: "Panel · 01", meta: M("Date", "Time", "Room"), cta: "RSVP: link in bio" },
  },
  {
    key: "workflow",
    family: "shock",
    name: "Workflow Session",
    description: "A professional shows how they use AI. Black.",
    template: "speaker",
    isEvent: true,
    fields: { ground: "ink", series: "Workflow session · 01", meta: M("Date", "Time", "Tools"), cta: "Open to every major" },
  },
  {
    key: "workshop",
    family: "signal",
    name: "Workshop",
    description: "Student-led and hands-on. Black.",
    template: "event",
    isEvent: true,
    fields: { ground: "ink", series: "Workshop · 01", meta: M("Date", "Time", "Room"), cta: "RSVP: link in bio" },
  },
  {
    key: "build",
    family: "signal",
    name: "Project events",
    description: "Build nights, hackathons, anything we build. Black.",
    template: "event",
    isEvent: true,
    fields: { ground: "ink", series: "Project event · 01", meta: M("Dates", "Hours", "Prizes"), cta: "Sign up: link in bio" },
  },
  {
    key: "partner",
    family: "shock",
    name: "Partner event",
    description: "Co-hosted with an organization, with their logo. Ivory.",
    template: "event",
    isEvent: true,
    fields: {
      ground: "paper",
      series: "Partner event",
      kicker: "Co-hosted",
      meta: M("Date", "Time", "Room"),
      cta: "RSVP: link in bio",
      partnerPlace: "footer",
    },
  },
  {
    key: "open-floor",
    family: "field",
    name: "Open Floor",
    description: "Ethics, data centers, jobs. Both sides, fairly.",
    template: "general",
    isEvent: true,
    fields: { ground: "paper", layout: "text", series: "Open floor · 01", meta: M("Date", "Time", "Format"), cta: "Bring your questions" },
  },
  {
    key: "photos",
    family: "field",
    name: "Session photos",
    description: "Pictures from an event: one, a grid or full bleed.",
    template: "general",
    isEvent: false,
    fields: { ground: "ink", layout: "grid", series: "From the session", images: [null, null, null] },
  },
  {
    key: "news",
    family: "field",
    name: "Club news",
    description: "Recruiting, announcements, anything else.",
    template: "general",
    isEvent: false,
    fields: { ground: "paper", layout: "text", series: "Club news" },
  },
  {
    key: "recap",
    family: "field",
    name: "Recap",
    description: "Two to four real numbers after an event.",
    template: "recap",
    isEvent: false,
    fields: { ground: "ink", series: "Recap", stats: [{ value: "", label: "" }, { value: "", label: "" }], page: "01 / 05" },
  },
  {
    key: "blank",
    family: "classic",
    name: "Blank canvas",
    description: "Ground, grid and logo only. Export it and finish in Canva.",
    template: "blank",
    isEvent: false,
    fields: { ground: "paper", grid: true, header: true, series: "" },
  },
];

export const EVENT_PRESETS = PRESETS.filter((p) => p.isEvent);

export function presetByKey(key: string): Preset {
  return PRESETS.find((p) => p.key === key) ?? PRESETS[PRESETS.length - 1]!;
}

/** A full, empty field set for a template, with the preset's defaults applied. */
export function blankFields(template: TemplateKey, preset?: Preset): SlideFields {
  const base: SlideFields = {
    ground: "paper",
    series: "",
    kicker: "",
    headline: "",
    dek: "",
    meta: [],
    cta: "",
    page: "",
    partners: [],
    partnerPlace: "none",
    partnerLabel: "",
  };
  if (template === "speaker") Object.assign(base, { speakers: [{ name: "", role: "", photo: null }], bw: true, bleed: false });
  if (template === "general") Object.assign(base, { layout: "photo", images: [null], bw: false });
  if (template === "recap") Object.assign(base, { stats: [{ value: "", label: "" }, { value: "", label: "" }] });
  if (template === "blank") Object.assign(base, { grid: true, header: true });
  const fields = structuredClone({ ...base, ...(preset?.template === template ? preset.fields : { ground: preset?.fields.ground ?? "paper" }) });
  return fields as SlideFields;
}

/**
 * The post plan an event gets: what goes out, when (days relative to the event's start, at a
 * local hour), on which channel and in which format. Officers can delete or move any of them.
 */
export interface PlanStep {
  kind: "announce" | "linkedin" | "reminder" | "day_of" | "recap";
  label: string;
  /** Days before (negative) or after the event's start date. */
  dayOffset: number;
  /** Local hour (America/Chicago) the post is scheduled for. */
  hour: number;
  channels: ("instagram" | "linkedin" | "story")[];
  formats: Format[];
  /** "preset" uses the series template; otherwise a fixed template. */
  template: "preset" | TemplateKey;
}

export const EVENT_PLAN: PlanStep[] = [
  { kind: "announce", label: "Announcement", dayOffset: -12, hour: 12, channels: ["instagram"], formats: ["feed", "story"], template: "preset" },
  { kind: "linkedin", label: "LinkedIn post", dayOffset: -10, hour: 9, channels: ["linkedin"], formats: ["wide"], template: "event" },
  { kind: "reminder", label: "Reminder, the day before", dayOffset: -1, hour: 17, channels: ["story"], formats: ["story"], template: "preset" },
  { kind: "day_of", label: "Day of", dayOffset: 0, hour: 9, channels: ["story"], formats: ["story"], template: "preset" },
  { kind: "recap", label: "Recap", dayOffset: 2, hour: 12, channels: ["instagram", "linkedin"], formats: ["feed"], template: "recap" },
];

export const KIND_LABEL: Record<string, string> = {
  announce: "Announcement",
  linkedin: "LinkedIn post",
  reminder: "Reminder",
  day_of: "Day of",
  recap: "Recap",
  photos: "Photos",
  custom: "Post",
};
