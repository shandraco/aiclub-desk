import { describe, expect, it } from "vitest";
import { boxFromFocus, focusFromBox, geom, moveBox, resizeBox } from "@/components/editor/crop";
import { getImage, setImage, slotPath, softness } from "@/components/editor/slots";
import { getText, isMultiline, issueTarget, setText, targetPath, textLabel } from "@/components/editor/targets";
import { blankFields } from "@/lib/brand/presets";

describe("photo slots", () => {
  it("reads and writes speaker and general photos without mutating", () => {
    const f = blankFields("speaker");
    const img = { src: "/uploads/photos/a.jpg", w: 800, h: 1000 };
    const g = setImage(f, "speakers.0", img);
    expect(getImage(g, "speakers.0")).toEqual(img);
    expect(f.speakers![0]!.photo).toBeNull();
    const gen = setImage(blankFields("general"), "images.2", img);
    expect(gen.images).toEqual([null, null, img]);
  });
  it("maps slots to brand-check paths", () => {
    expect(slotPath(1, "speakers.0")).toBe("slides.1.speakers.0.photo");
    expect(slotPath(0, "images.3")).toBe("slides.0.images.3");
  });
  it("flags photos enlarged past their size", () => {
    expect(softness({ w: 1000, h: 1000, zoom: 1 }, { w: 936, h: 440 })).toBeCloseTo(0.936);
    expect(softness({ w: 600, h: 600, zoom: 2 }, { w: 500, h: 500 })).toBeGreaterThan(1.15);
    expect(softness({ zoom: 1 }, { w: 500, h: 500 })).toBe(0);
  });
});

describe("crop geometry", () => {
  const g = geom({ w: 400, h: 400 }, 1200, 800);
  it("round-trips focus point and zoom through the crop box", () => {
    for (const f of [{ x: 50, y: 50, zoom: 1 }, { x: 20, y: 70, zoom: 1.6 }, { x: 100, y: 0, zoom: 3 }]) {
      const back = focusFromBox(g, boxFromFocus(g, f));
      expect(back.zoom).toBeCloseTo(f.zoom, 5);
      expect(back.x).toBeCloseTo(f.x, 5);
      // At zoom 1 there is no vertical slack on a landscape photo in a square frame.
      if (f.zoom > 1) expect(back.y).toBeCloseTo(f.y, 5);
    }
  });
  it("keeps a moved box inside the image", () => {
    const b = moveBox(g, boxFromFocus(g, { x: 50, y: 50, zoom: 2 }), 10_000, -10_000);
    expect(b.l + b.w).toBeCloseTo(1200);
    expect(b.t).toBe(0);
  });
  it("keeps the frame's shape when resizing and never zooms past 3", () => {
    const b = resizeBox(g, boxFromFocus(g, { zoom: 1 }), "br", 1, 1);
    expect(b.w / b.h).toBeCloseTo(1);
    expect(focusFromBox(g, b).zoom).toBeLessThanOrEqual(3);
  });
});

describe("canvas targets", () => {
  it("reads and writes nested text fields", () => {
    const f = { ...blankFields("event"), meta: [{ label: "Date", value: "" }] };
    const g = setText(f, "meta.0.value", "Thu, Oct 8");
    expect(getText(g, "meta.0.value")).toBe("Thu, Oct 8");
    expect(getText(f, "meta.0.value")).toBe("");
    expect(setText(f, "meta.3.value", "x")).toBe(f);
    expect(getText(setText(f, "headline", "Hi"), "headline")).toBe("Hi");
  });
  it("labels and line-break rules", () => {
    expect(textLabel("speakers.1.role")).toBe("Speaker 2 title");
    expect(isMultiline("headline")).toBe(true);
    expect(isMultiline("meta.0.value")).toBe(false);
  });
  it("routes issue paths to what to select", () => {
    expect(issueTarget("slides.2.meta.1")).toEqual({ slide: 2, text: "meta.1.value" });
    expect(issueTarget("slides.0.speakers.1.photo")).toEqual({ slide: 0, photo: "speakers.1" });
    expect(issueTarget("captions.alt")).toMatchObject({ pane: "captions", field: "captions.alt" });
    expect(issueTarget("slides.1.stats")).toEqual({ slide: 1, text: "stats.0.value" });
    expect(targetPath(1, "photo:speakers.0")).toBe("slides.1.speakers.0.photo");
    expect(targetPath(0, "meta.2.label")).toBe("slides.0.meta.2");
  });
});
