import { describe, expect, it } from "vitest";
import { checkCaptions, checkSlide, voice } from "@/lib/brand/checks";
import { blankFields, presetByKey } from "@/lib/brand/presets";
import { renumber, slideForEvent, type EventContext } from "@/lib/posts/factory";
import type { Slide } from "@/lib/posts/types";
import { fromZoned } from "@/lib/time";

const slide = (over: Partial<Slide["fields"]> = {}, template: Slide["template"] = "event"): Slide => ({
  id: "s1",
  template,
  fields: { ...blankFields(template), headline: "Build your first RAG app in 90 minutes", ...over },
});

describe("brand checks", () => {
  it("passes a clean event slide", () => {
    expect(checkSlide(slide(), 0, 1).filter((i) => i.level === "error")).toEqual([]);
  });
  it("flags banned phrases with the phrase named", () => {
    expect(voice("We're thrilled to leverage AI", "Headline", "h").map((i) => i.text)).toEqual([
      "Headline uses “thrilled”. Say the specific thing instead.",
      "Headline uses “leverage”. Say the specific thing instead.",
    ]);
  });
  it("enforces headline length, exclamation marks and emoji", () => {
    const texts = checkSlide(slide({ headline: "One two three four five six seven eight nine ten eleven twelve thirteen!" }), 0, 1).map((i) => i.text);
    expect(texts).toContain("Headline is 13 words. Keep it to 12.");
    expect(texts).toContain("No exclamation marks on graphics.");
    expect(checkSlide(slide({ headline: "Robots 🤖 tonight" }), 0, 1).map((i) => i.text)).toContain("No emoji on graphics.");
  });
  it("only lets Open Floor ask questions", () => {
    expect(checkSlide(slide({ headline: "Should Wichita want a data center?" }), 0, 1).some((i) => i.text.startsWith("Headlines are statements"))).toBe(true);
    expect(checkSlide(slide({ headline: "Should Wichita want a data center?", series: "Open floor · 01" }), 0, 1).some((i) => i.text.startsWith("Headlines are statements"))).toBe(false);
  });
  it("names the slide in a carousel", () => {
    expect(checkSlide(slide({ headline: "" }), 1, 3)[0]!.text).toBe("Slide 2: Add a headline.");
  });
  it("requires speaker photos and names", () => {
    const texts = checkSlide(slide({}, "speaker"), 0, 1).map((i) => i.text);
    expect(texts).toContain("Speaker 1 has no photo.");
    expect(texts).toContain("Speaker 1 has no name.");
  });
  it("checks captions against each channel's rules", () => {
    const texts = checkCaptions({ linkedin: "Short. #a #b #c #d", instagram: "x".repeat(130), alt: "" }, ["instagram", "linkedin"]).map((i) => i.text);
    expect(texts).toContain("LinkedIn caption is 5 words. Aim for 60 to 150.");
    expect(texts).toContain("LinkedIn takes 3 hashtags at most.");
    expect(texts).toContain("Instagram cuts the first line at 125 characters.");
    expect(texts).toContain("Write alt text before posting.");
  });
  it("warns when a channel has no caption", () => {
    expect(checkCaptions({ linkedin: "", instagram: "", alt: "x" }, ["linkedin"]).map((i) => i.text)).toEqual(["This post goes to LinkedIn but has no LinkedIn caption."]);
  });
});

const ev: EventContext = {
  id: "e1",
  title: "Build your first RAG app",
  preset: "workshop",
  seriesLabel: "Workshop · 03",
  summary: "Bring a laptop.",
  startsAt: fromZoned(2026, 10, 14, 18, 0),
  endsAt: fromZoned(2026, 10, 14, 19, 30),
  place: "",
  rsvpUrl: "https://example.test/rsvp",
  room: { name: "Rhatigan Student Center 233", short: "RSC 233" },
  speakers: [],
  partners: [{ id: "p1", name: "Partner Co", logo: "/x.png", tone: "original" }],
  attendance: 41,
  rsvps: 60,
};

describe("post factory", () => {
  it("fills the data strip from the event in Wichita time", () => {
    const s = slideForEvent(ev, "preset", "announce");
    expect(s.template).toBe(presetByKey("workshop").template);
    expect(s.fields.meta).toEqual([
      { label: "Date", value: "Wed, Oct 14" },
      { label: "Time", value: "6 PM to 7:30 PM" },
      { label: "Room", value: "RSC 233" },
    ]);
    expect(s.fields.series).toBe("Workshop · 03");
    expect(s.fields.partners?.[0]?.name).toBe("Partner Co");
    expect(s.fields.partnerPlace).toBe("footer");
  });
  it("marks reminders and day-of posts", () => {
    expect(slideForEvent(ev, "preset", "reminder").fields.kicker).toBe("Tomorrow");
    expect(slideForEvent(ev, "preset", "day_of").fields.kicker).toBe("Today · 6 PM");
  });
  it("builds the recap from recorded turnout, never invented numbers", () => {
    const r = slideForEvent(ev, "recap", "recap");
    expect(r.fields.stats).toEqual([
      { value: "41", label: "Came" },
      { value: "60", label: "RSVPs" },
    ]);
    const empty = slideForEvent({ ...ev, attendance: null, rsvps: null }, "recap", "recap");
    expect(empty.fields.stats?.every((s) => s.value === "")).toBe(true);
  });
  it("numbers carousel slides and clears the counter on a single graphic", () => {
    const a = slideForEvent(ev, "event");
    const b = slideForEvent(ev, "event");
    expect(renumber([a, b]).map((s) => s.fields.page)).toEqual(["01 / 02", "02 / 02"]);
    expect(renumber([{ ...a, fields: { ...a.fields, page: "01 / 02" } }])[0]!.fields.page).toBe("");
  });
  it("draws each series in its family, recaps in Field", () => {
    expect(slideForEvent(ev, "preset", "announce").family).toBe("signal"); // workshop
    expect(slideForEvent({ ...ev, preset: "speaker-series" }, "preset", "announce").family).toBe("shock");
    expect(slideForEvent({ ...ev, preset: "speaker-series" }, "recap", "recap").family).toBe("field");
    expect(slideForEvent({ ...ev, preset: "open-floor" }, "preset", "announce").family).toBe("field");
  });
});
