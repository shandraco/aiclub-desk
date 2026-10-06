import { fmtDateLong, fmtTime } from "@/lib/time";
import type { EventContext } from "./factory";
import type { Captions, Slide } from "./types";

/**
 * Caption starting points built from the post and its event: no AI, no outside service.
 * Pure, so it is unit-testable and runs anywhere.
 */
export interface DraftInput {
  kind: string;
  channels: string[];
  slides: Slide[];
  event: EventContext | null;
}

/** A plain first draft from the facts already in the desk. Officers edit it; the brand checks run on the result. */
export function draftFromTemplate(input: DraftInput): Captions {
  const ev = input.event;
  const cover = input.slides[0]?.fields;
  const headline = cover?.headline || ev?.title || "";
  if (!ev) {
    return {
      linkedin: [headline, cover?.dek].filter(Boolean).join("\n\n"),
      instagram: [headline, cover?.dek].filter(Boolean).join("\n\n"),
      alt: `${headline}. A graphic from the AI Club at Wichita State University.`,
    };
  }
  const when = `${fmtDateLong(ev.startsAt)}, ${fmtTime(ev.startsAt, true)}`;
  const where = ev.room?.name ?? ev.place;
  const who = ev.speakers.map((s) => (s.role ? `${s.name} (${s.role})` : s.name)).join(", ");
  const logistics = [when, where].filter(Boolean).join(" · ");
  return {
    linkedin: [
      `${ev.title}${who ? ` with ${who}` : ""}.`,
      ev.summary,
      `${logistics}. Open to every Wichita State student.${ev.rsvpUrl ? ` RSVP: ${ev.rsvpUrl}` : ""}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    instagram: [headline.slice(0, 125), "", ev.summary, logistics, ev.rsvpUrl ? "RSVP: link in bio" : ""].filter((x, i) => x || i === 1).join("\n").trim(),
    alt: `${headline}. ${input.slides[0]?.template === "speaker" && who ? `Photo of ${who}. ` : ""}${logistics}.`,
  };
}
