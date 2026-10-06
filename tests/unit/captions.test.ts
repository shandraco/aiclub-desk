import { describe, expect, it } from "vitest";
import { checkCaptions } from "@/lib/brand/checks";
import { blankFields } from "@/lib/brand/presets";
import { draftFromTemplate } from "@/lib/posts/captions";
import { fromZoned } from "@/lib/time";

const event = {
  id: "e1", title: "Build a study bot", preset: "workshop", seriesLabel: "Workshop 03", summary: "Bring a laptop.",
  startsAt: fromZoned(2026, 10, 15, 17, 0), endsAt: null, place: "", rsvpUrl: "https://example.test/rsvp",
  room: { name: "Ablah Library 310", short: "Ablah 310" }, speakers: [{ id: "s1", name: "Jordan Lee", role: "Data lead", photo: null }], partners: [],
};
const slides = [{ id: "a", template: "event" as const, fields: { ...blankFields("event"), headline: "Build a study bot" } }];

describe("caption template", () => {
  it("fills captions from the event's facts in Wichita time, with no banned phrases", () => {
    const c = draftFromTemplate({ kind: "announce", channels: ["instagram"], slides, event });
    expect(c.instagram.split("\n")[0]).toBe("Build a study bot");
    expect(c.instagram).toContain("Thursday, October 15, 5 PM");
    expect(c.instagram).toContain("RSVP: link in bio");
    expect(c.linkedin).toContain("Jordan Lee (Data lead)");
    expect(c.alt.startsWith("Build a study bot.")).toBe(true);
    expect(checkCaptions(c, ["instagram"]).filter((i) => i.level === "error")).toEqual([]);
  });
  it("works for a post with no event", () => {
    expect(draftFromTemplate({ kind: "custom", channels: [], slides, event: null }).alt).toContain("Build a study bot");
  });
});
