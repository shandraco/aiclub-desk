import { blankFields, presetByKey, type PlanStep } from "@/lib/brand/presets";
import { fmtDate, fmtTime } from "@/lib/time";
import type { Captions, ImageRef, MetaCell, PartnerLogo, Slide, SlideFields, SpeakerSlot, TemplateKey } from "./types";

/**
 * Builds post content from an event's facts, so an officer types the date, room and speakers
 * once. Pure: no database, so it is unit-tested and shared by the event planner and the editor.
 */

export interface EventContext {
  id: string;
  title: string;
  preset: string;
  seriesLabel: string;
  summary: string;
  startsAt: Date;
  endsAt: Date | null;
  place: string;
  rsvpUrl: string;
  room: { name: string; short: string } | null;
  speakers: { id: string; name: string; role: string; photo: ImageRef | null }[];
  partners: { id: string; name: string; logo: string | null; tone: PartnerLogo["tone"] }[];
  rsvps?: number | null;
  attendance?: number | null;
}

export const newSlideId = () => Math.random().toString(36).slice(2, 10);
export const emptyCaptions = (): Captions => ({ linkedin: "", instagram: "", alt: "" });

/** "Tue, Oct 14" for one day; "Oct 14 to 16" for a multi-day event. */
function dateValue(ev: EventContext): string {
  if (ev.endsAt && fmtDate(ev.endsAt) !== fmtDate(ev.startsAt)) {
    const a = fmtDate(ev.startsAt).replace(/^\w+, /, "");
    const b = fmtDate(ev.endsAt).replace(/^\w+, \w+ /, "");
    return `${a} to ${b}`;
  }
  return fmtDate(ev.startsAt);
}

function timeValue(ev: EventContext): string {
  const a = fmtTime(ev.startsAt, true);
  return ev.endsAt ? `${a} to ${fmtTime(ev.endsAt, true)}` : a;
}

/** Fills the preset's data strip labels from the event: Date, Time, Room, Dates, Hours. */
function fillMeta(meta: MetaCell[], ev: EventContext): MetaCell[] {
  return meta.map((m) => {
    const l = m.label.toLowerCase();
    if (l === "date" || l === "dates") return { ...m, value: dateValue(ev) };
    if (l === "time" || l === "hours") return { ...m, value: timeValue(ev) };
    if (l === "room") return { ...m, value: ev.room?.short || ev.place };
    return m;
  });
}

function speakersFrom(ev: EventContext): SpeakerSlot[] {
  return ev.speakers.slice(0, 4).map((s) => ({ name: s.name, role: s.role, photo: s.photo, speakerId: s.id }));
}

function partnersFrom(ev: EventContext): PartnerLogo[] {
  return ev.partners
    .filter((p) => p.logo)
    .slice(0, 3)
    .map((p) => ({ src: p.logo!, name: p.name, tone: p.tone, partnerId: p.id }));
}

/** The cover slide for a plan step (or a plain post) of an event. */
export function slideForEvent(ev: EventContext, template: TemplateKey | "preset", kind?: PlanStep["kind"]): Slide {
  const preset = presetByKey(ev.preset);
  const t: TemplateKey = template === "preset" ? preset.template : template;
  const f: SlideFields = blankFields(t, preset);
  f.series = ev.seriesLabel || f.series;
  f.headline = ev.title;
  f.dek = t === "event" || t === "general" ? ev.summary : "";
  f.meta = fillMeta(f.meta.length ? f.meta : t === "event" ? [{ label: "Date", value: "" }, { label: "Time", value: "" }, { label: "Room", value: "" }] : [], ev);
  if (t === "speaker") {
    const sp = speakersFrom(ev);
    f.speakers = sp.length ? sp : [{ name: "", role: "", photo: null }];
  }
  const logos = partnersFrom(ev);
  if (logos.length) {
    f.partners = logos;
    if (!f.partnerPlace || f.partnerPlace === "none") f.partnerPlace = "footer";
  }
  if (kind === "reminder") f.kicker = "Tomorrow";
  if (kind === "day_of") f.kicker = `Today · ${fmtTime(ev.startsAt, true)}`;
  if (kind === "linkedin" && !f.kicker) f.kicker = ev.speakers[0] ? ev.speakers[0].name : "";
  if (t === "recap") {
    f.ground = "ink";
    f.series = `Recap · ${ev.seriesLabel || preset.name}`;
    f.headline = `${ev.title} in numbers`;
    f.meta = [];
    f.stats = [
      { value: ev.attendance ? String(ev.attendance) : "", label: ev.attendance ? "Came" : "" },
      { value: ev.rsvps ? String(ev.rsvps) : "", label: ev.rsvps ? "RSVPs" : "" },
    ];
    f.page = "";
  }
  if (!f.cta && ev.rsvpUrl && kind !== "recap") f.cta = "RSVP: link in bio";
  // Recaps are always drawn in Field (grown from the event's words); everything else in the series' family.
  return { id: newSlideId(), template: t, family: t === "recap" ? "field" : preset.family, fields: f };
}

/** A fresh post for a preset with no event (club news, photos, blank canvas). */
export function slideForPreset(presetKey: string): Slide {
  const preset = presetByKey(presetKey);
  return { id: newSlideId(), template: preset.template, family: preset.family, fields: blankFields(preset.template, preset) };
}

/**
 * A follow-on carousel slide: same ground and series as the slide before it, empty words.
 * The slide counter ("02 / 04") is renumbered across the whole set.
 */
export function nextSlide(prev: Slide, template?: TemplateKey): Slide {
  const t = template ?? (prev.template === "speaker" ? "event" : prev.template);
  const f = blankFields(t);
  f.ground = prev.fields.ground;
  f.series = prev.fields.series;
  f.cta = prev.fields.cta;
  return { id: newSlideId(), template: t, family: prev.family, fields: f };
}

/** Sets "01 / 05" counters on every slide of a carousel; clears them on a single graphic. */
export function renumber(slides: Slide[]): Slide[] {
  const n = slides.length;
  const pad = (i: number) => String(i).padStart(2, "0");
  return slides.map((s, i) => ({ ...s, fields: { ...s.fields, page: n > 1 ? `${pad(i + 1)} / ${pad(n)}` : s.fields.page && /^\d+ \/ \d+$/.test(s.fields.page) ? "" : s.fields.page } }));
}
