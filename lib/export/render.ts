import { getFontEmbedCSS, toBlob } from "html-to-image";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { PostCanvas } from "@/components/post/PostCanvas";
import { captionsText, exportJobs, pngName, postSlug } from "./names";
import { buildZip } from "./zip";
import { SIZES, TEMPLATES, type Captions, type Format, type Slide } from "@/lib/posts/types";

/**
 * Client-side PNG export. Each slide is drawn by the same PostCanvas as the preview, at
 * scale 1, into an off-screen stage, then rasterised with html-to-image at full size.
 * Browser only: call from event handlers in client components.
 */

let fontCss: Promise<string> | null = null;

/** Safari draws images late on the first pass of an SVG foreignObject; the old desk rendered twice. */
const isSafari = () => typeof navigator !== "undefined" && /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Android/.test(navigator.userAgent);

function makeStage(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  // Off-screen but visible: html-to-image copies computed styles, so visibility:hidden would be copied too.
  Object.assign(el.style, { position: "fixed", left: "-100000px", top: "0", pointerEvents: "none", zIndex: "-1" });
  document.body.appendChild(el);
  return el;
}

/**
 * The @font-face CSS for all three brand faces, fetched once. html-to-image only embeds the
 * families a node uses, so it is computed from a probe that uses every face, not from one
 * slide (a slide with no dek would leave Newsreader out of every later slide).
 */
function brandFontCss(stage: HTMLElement): Promise<string> {
  if (fontCss) return fontCss;
  const probe = document.createElement("div");
  const root = getComputedStyle(document.documentElement);
  for (const v of ["--font-geist", "--font-geist-mono", "--font-newsreader", "--font-bricolage", "--font-gabarito", "--font-bigshoulders"]) {
    const span = document.createElement("span");
    span.textContent = "Aa";
    span.style.fontFamily = root.getPropertyValue(v).trim() || "inherit";
    probe.appendChild(span);
  }
  stage.appendChild(probe);
  fontCss = getFontEmbedCSS(probe)
    .catch(() => "")
    .finally(() => probe.remove());
  return fontCss;
}

async function settle(node: HTMLElement) {
  if (document.fonts?.ready) await document.fonts.ready;
  await Promise.all(
    [...node.querySelectorAll("img")].map((img) =>
      img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => undefined),
    ),
  );
}

export interface Job {
  slide: Slide;
  format: Format;
}

/** Renders jobs one at a time into PNG blobs. onEach is told before each job starts. */
export async function renderPngs(jobs: Job[], onEach?: (i: number, job: Job) => void): Promise<Blob[]> {
  const stage = makeStage();
  const root = createRoot(stage);
  const out: Blob[] = [];
  try {
    const css = await brandFontCss(stage);
    for (const [i, job] of jobs.entries()) {
      onEach?.(i, job);
      flushSync(() => root.render(createElement(PostCanvas, { slide: job.slide, format: job.format, scale: 1 })));
      const node = stage.querySelector<HTMLElement>(".aic-post");
      if (!node) throw new Error("Couldn’t draw the graphic. Reload the page and try again.");
      await settle(node);
      const [width, height] = SIZES[job.format];
      const opts = { width, height, pixelRatio: 1, fontEmbedCSS: css, cacheBust: false };
      if (isSafari()) await toBlob(node, opts).catch(() => null);
      const blob = await toBlob(node, opts);
      if (!blob) throw new Error("Couldn’t draw the image. Try again.");
      out.push(blob);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Couldn")) throw err;
    // html-to-image rejects with an Event when an image fails to load (usually a photo whose host refused it).
    throw new Error("A photo or logo couldn’t be loaded for the export. Re-upload it, then try again.");
  } finally {
    root.unmount();
    stage.remove();
  }
  return out;
}

export const supportedFormats = (s: Slide): Format[] => TEMPLATES[s.template]?.formats ?? ["feed"];

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Downloads one slide in one format. */
export async function downloadPng(slides: Slide[], index: number, format: Format) {
  const slide = slides[index];
  if (!slide) return;
  const [blob] = await renderPngs([{ slide, format }]);
  saveBlob(blob!, pngName(postSlug(slides), format, index));
}

/** Builds one zip: every slide in every chosen format, plus captions.txt. */
export async function downloadZip(slides: Slide[], formats: Format[], captions: Captions, onProgress?: (text: string) => void) {
  const jobs = exportJobs(slides, formats, supportedFormats);
  if (!jobs.length) throw new Error("None of the chosen formats fit these slides. Pick a format in post settings.");
  const slug = postSlug(slides);
  const blobs = await renderPngs(jobs, (i, job) => {
    onProgress?.(`Drawing ${i + 1} of ${jobs.length}: slide ${jobs[i]!.index + 1}, ${job.format}`);
  });
  onProgress?.("Packing the zip");
  const files: { name: string; data: Uint8Array | string }[] = await Promise.all(
    jobs.map(async (j, i) => ({ name: pngName(slug, j.format, j.index), data: new Uint8Array(await blobs[i]!.arrayBuffer()) })),
  );
  files.push({ name: "captions.txt", data: captionsText(captions) });
  const zip = buildZip(files);
  saveBlob(new Blob([zip as BlobPart], { type: "application/zip" }), `aiclub-${slug}.zip`);
  return jobs.length;
}
