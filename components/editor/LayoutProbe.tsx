"use client";

import { useEffect, useRef, useState } from "react";
import { PostCanvas } from "@/components/post/PostCanvas";
import type { Issue } from "@/lib/brand/checks";
import { FORMAT_LABEL, TEMPLATES, type Format, type Slide } from "@/lib/posts/types";
import { getImage, slotPath, SOFT_LIMIT, softness } from "./slots";
import styles from "./editor.module.css";

export interface ProbeResult {
  issues: Issue[];
  /** Frame sizes in canvas pixels, keyed "slide:format:slot". */
  frames: Record<string, { w: number; h: number }>;
}

/**
 * Layout checks the brand rules can't make from the words alone. Every slide is drawn at full
 * size in every format being exported, off-screen, and measured: text that runs out of the
 * main area, data-strip values cut off, photos smaller than their frames.
 */
export function LayoutProbe({ slides, formats, onResult }: { slides: Slide[]; formats: Format[]; onResult: (r: ProbeResult) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const cb = useRef(onResult);
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    cb.current = onResult;
  });

  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      const el = root.current;
      if (!el || cancelled) return;
      const issues: Issue[] = [];
      const frames: ProbeResult["frames"] = {};
      const total = slides.length;
      const soft = new Set<string>();
      for (const node of el.querySelectorAll<HTMLElement>("[data-probe]")) {
        const [si, fmt] = node.dataset.probe!.split(":") as [string, Format];
        const i = Number(si);
        const slide = slides[i];
        if (!slide) continue;
        const name = total > 1 ? `Slide ${i + 1}: ` : "";
        const fname = FORMAT_LABEL[fmt].toLowerCase();
        // Fit: every piece of text must sit inside the canvas and inside its content area.
        const post = node.querySelector<HTMLElement>(".aic-post") ?? node;
        const area = (post.querySelector<HTMLElement>(".aic-main") ?? post).getBoundingClientRect();
        const pr = post.getBoundingClientRect();
        let spill = false;
        node.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const inMain = el.closest(".aic-main") !== null;
          const box = inMain ? area : pr;
          if (r.top < box.top - 2 || r.bottom > box.bottom + 2 || r.left < pr.left - 2 || r.right > pr.right + 2) spill = true;
        });
        if (spill) {
          issues.push({ level: "error", path: `slides.${i}.headline`, text: `${name}Text doesn’t fit the ${fname} format. Shorten the headline or dek, or drop a data-strip cell.` });
        }
        // Single-line values that are cut off (the data strip ellipsis).
        node.querySelectorAll<HTMLElement>('[data-field^="meta."][data-field$=".value"]').forEach((dd) => {
          if (dd.scrollWidth > dd.clientWidth + 1) {
            const k = dd.dataset.field!.split(".")[1];
            issues.push({ level: "warn", path: `slides.${i}.meta.${k}`, text: `${name}Data strip value ${Number(k) + 1} is cut off in ${fname}. Shorten it (“Thu, Oct 8”).` });
          }
        });
        node.querySelectorAll<HTMLElement>("[data-slot]").forEach((s) => {
          const key = s.dataset.slot!;
          const frame = { w: s.offsetWidth, h: s.offsetHeight };
          frames[`${i}:${fmt}:${key}`] = frame;
          const img = getImage(slide.fields, key);
          const tag = s.querySelector("img");
          const sized = img && !img.w && tag?.naturalWidth ? { ...img, w: tag.naturalWidth, h: tag.naturalHeight } : img;
          const path = slotPath(i, key);
          if (softness(sized, frame) > SOFT_LIMIT && !soft.has(path)) {
            soft.add(path);
            issues.push({ level: "warn", path, text: `${name}A photo is smaller than its frame in ${fname} and will look soft. Use a larger file or zoom out.` });
          }
        });
      }
      cb.current({ issues, frames });
    };
    const t = setTimeout(measure, 150);
    void document.fonts?.ready.then(() => setTimeout(measure, 0));
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [slides, formats, loads]);

  return (
    <div
      ref={root}
      className={styles.probe}
      aria-hidden="true"
      inert
      // A photo finished loading: its natural size is known now, so measure again.
      onLoadCapture={() => setLoads((n) => n + 1)}
    >
      {slides.flatMap((slide, i) =>
        formats
          .filter((f) => TEMPLATES[slide.template].formats.includes(f))
          .map((f) => (
            <div key={`${slide.id}:${f}`} data-probe={`${i}:${f}`}>
              <PostCanvas slide={slide} format={f} scale={1} />
            </div>
          )),
      )}
    </div>
  );
}
