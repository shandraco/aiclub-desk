import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { captionsText, exportJobs, pngName, postSlug, slugify } from "@/lib/export/names";
import { buildZip } from "@/lib/export/zip";
import { TEMPLATES, type Slide } from "@/lib/posts/types";
import { blankFields } from "@/lib/brand/presets";

const slide = (template: Slide["template"], headline = ""): Slide => ({ id: headline || template, template, fields: { ...blankFields(template), headline } });
const supported = (s: Slide) => TEMPLATES[s.template].formats;

describe("export names", () => {
  it("slugs headlines safely", () => {
    expect(slugify("Build night: Café ’26!")).toBe("build-night-cafe-26");
    expect(slugify("   ")).toBe("post");
    expect(slugify("a".repeat(80)).length).toBeLessThanOrEqual(48);
  });
  it("names files aiclub-<slug>-<format>-<nn>.png", () => {
    expect(pngName("workshop-03", "story", 0)).toBe("aiclub-workshop-03-story-01.png");
    expect(pngName("x", "feed", 11)).toBe("aiclub-x-feed-12.png");
  });
  it("uses the cover headline, then the series", () => {
    const s = slide("event", "");
    s.fields.series = "Workshop · 03";
    expect(postSlug([s])).toBe("workshop-03");
  });
  it("skips formats a slide's template doesn't come in", () => {
    const jobs = exportJobs([slide("event", "a"), slide("speaker", "b")], ["feed", "wide"], supported);
    expect(jobs.map((j) => `${j.index}:${j.format}`)).toEqual(["0:feed", "1:feed", "0:wide"]);
  });
  it("writes every caption into captions.txt", () => {
    const t = captionsText({ linkedin: "LI text", instagram: "", alt: "Alt" });
    expect(t).toContain("LinkedIn\n--------\nLI text");
    expect(t).toContain("Instagram\n---------\n(empty)");
    expect(t).toContain("Alt text");
  });
});

describe("buildZip", () => {
  it("round-trips images and text", () => {
    const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const out = unzipSync(buildZip([{ name: "a.png", data: png }, { name: "captions.txt", data: "hello" }]));
    expect([...out["a.png"]!]).toEqual([...png]);
    expect(strFromU8(out["captions.txt"]!)).toBe("hello");
  });
});
