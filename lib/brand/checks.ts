import type { Captions, Slide } from "@/lib/posts/types";

/**
 * The brand and voice rules, carried over from the original desk. Pure functions, so the
 * editor, the caption drafter and the approval step all run the same checks.
 * "error" means it breaks the brand guide; "warn" means look again.
 */
export type Level = "error" | "warn";
export interface Issue {
  level: Level;
  text: string;
  /** Field path the issue belongs to, e.g. "slides.0.headline" or "captions.linkedin". */
  path: string;
}

export const BANNED: [RegExp, string][] = [
  [/excited to announce/i, "excited to announce"],
  [/\bthrilled\b/i, "thrilled"],
  [/game[- ]?changer/i, "game-changer"],
  [/revolutioni[sz]/i, "revolutionize"],
  [/\bunleash/i, "unleash"],
  [/supercharg/i, "supercharge"],
  [/cutting[- ]edge/i, "cutting-edge"],
  [/harness(ing)? the power/i, "harness the power"],
  [/\bdelv(e|es|ing)\b/i, "delve"],
  [/\bleverag(e|es|ing)\b/i, "leverage"],
  [/\bsynerg/i, "synergy"],
  [/the future of/i, "the future of"],
  [/don['’]?t miss (out|it)/i, "don't miss out"],
  [/\bjourney\b/i, "journey"],
  [/\blandscape\b/i, "landscape"],
  [/\becosystem/i, "ecosystem"],
  [/ai[- ]powered/i, "AI-powered"],
  [/fast[- ]paced world/i, "fast-paced world"],
  [/buckle up/i, "buckle up"],
];

const NUMWORDS =
  /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|hundred)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const EMOJI_G = /\p{Extended_Pictographic}/gu;

export const words = (s: string | undefined) => (String(s ?? "").trim().match(/\S+/g) ?? []).length;
const hashtags = (s: string) => (s.match(/(^|\s)#\w+/g) ?? []).length;

export function voice(value: string | undefined, where: string, path: string): Issue[] {
  const v = String(value ?? "");
  if (!v.trim()) return [];
  return BANNED.filter(([re]) => re.test(v)).map(([, w]) => ({
    level: "error" as const,
    text: `${where} uses “${w}”. Say the specific thing instead.`,
    path,
  }));
}

export function checkSlide(slide: Slide, index: number, total: number): Issue[] {
  const f = slide.fields;
  const t = slide.template;
  const out: Issue[] = [];
  const at = (k: string) => `slides.${index}.${k}`;
  const name = total > 1 ? `Slide ${index + 1}: ` : "";
  const add = (level: Level, text: string, path: string) => out.push({ level, text: name + text, path });
  const isFloor = /open floor/i.test(f.series || "");

  if (t !== "blank" && !f.headline.trim()) add("error", "Add a headline.", at("headline"));
  const hw = words(f.headline);
  if (hw > 12) add("error", `Headline is ${hw} words. Keep it to 12.`, at("headline"));
  if (/!/.test(f.headline + f.dek + f.kicker)) add("error", "No exclamation marks on graphics.", at("headline"));
  if (EMOJI.test(f.headline + f.dek + f.kicker + f.series)) add("error", "No emoji on graphics.", at("headline"));
  if (/\?/.test(f.headline) && !isFloor) add("warn", "Headlines are statements. Only Open Floor posts ask questions.", at("headline"));
  if (NUMWORDS.test(`${f.headline} ${f.dek}`)) add("warn", "Write numbers as digits.", at("headline"));
  const rest = f.headline.split(/\s+/).slice(1).filter((x) => /^[A-Za-z]{4,}/.test(x));
  if (rest.length >= 3 && rest.filter((x) => /^[A-Z]/.test(x)).length / rest.length > 0.6) {
    add("warn", "Headline looks like Title Case. Use sentence case.", at("headline"));
  }
  if (words(f.dek) > 25) add("warn", "Dek is over 25 words.", at("dek"));
  for (const [k, label] of [["headline", "Headline"], ["dek", "Dek"], ["kicker", "Kicker"]] as const) {
    for (const i of voice(f[k], label, at(k))) add(i.level, i.text, i.path);
  }

  (f.partners ?? []).forEach((lg, i) => {
    if (!lg?.src) add("warn", `Partner logo ${i + 1} is empty.`, at(`partners.${i}`));
  });
  if (t === "speaker") {
    (f.speakers ?? []).forEach((s, i) => {
      if (!s.photo?.src) add("error", `Speaker ${i + 1} has no photo.`, at(`speakers.${i}.photo`));
      if (!s.name.trim()) add("error", `Speaker ${i + 1} has no name.`, at(`speakers.${i}.name`));
    });
  }
  if (t === "general" && f.layout !== "text") {
    const imgs = f.layout === "grid" ? (f.images ?? []) : (f.images ?? []).slice(0, 1);
    imgs.forEach((im, i) => {
      if (!im?.src) add("error", `Photo ${i + 1} is empty.`, at(`images.${i}`));
    });
  }
  (f.meta ?? []).forEach((m, i) => {
    if ((m.label || m.value) && !(m.label && m.value)) add("warn", `Data strip cell ${i + 1} needs a label and a value.`, at(`meta.${i}`));
  });
  if (t === "recap" && (f.stats ?? []).filter((s) => s.value).length < 2) add("error", "Add at least two real numbers.", at("stats"));
  return out;
}

export function checkCaptions(c: Captions, channels: string[]): Issue[] {
  const out: Issue[] = [];
  const add = (level: Level, text: string, path: string) => out.push({ level, text, path });
  if (c.linkedin) {
    const lw = words(c.linkedin);
    if (lw < 60 || lw > 150) add("warn", `LinkedIn caption is ${lw} words. Aim for 60 to 150.`, "captions.linkedin");
    if (hashtags(c.linkedin) > 3) add("warn", "LinkedIn takes 3 hashtags at most.", "captions.linkedin");
    if (EMOJI.test(c.linkedin)) add("warn", "No emoji on LinkedIn.", "captions.linkedin");
    if ((c.linkedin.match(/!/g) ?? []).length > 1) add("warn", "One exclamation mark at most.", "captions.linkedin");
  } else if (channels.includes("linkedin")) {
    add("warn", "This post goes to LinkedIn but has no LinkedIn caption.", "captions.linkedin");
  }
  if (c.instagram) {
    if ((c.instagram.split("\n")[0] ?? "").length > 125) add("warn", "Instagram cuts the first line at 125 characters.", "captions.instagram");
    if (hashtags(c.instagram) > 5) add("warn", "Instagram: 5 hashtags at most.", "captions.instagram");
    if ((c.instagram.match(EMOJI_G) ?? []).length > 1) add("warn", "One emoji at most, and only if it carries information.", "captions.instagram");
    if ((c.instagram.match(/!/g) ?? []).length > 1) add("warn", "One exclamation mark at most.", "captions.instagram");
  } else if (channels.includes("instagram")) {
    add("warn", "This post goes to Instagram but has no Instagram caption.", "captions.instagram");
  }
  for (const i of voice(c.linkedin, "LinkedIn caption", "captions.linkedin")) out.push(i);
  for (const i of voice(c.instagram, "Instagram caption", "captions.instagram")) out.push(i);
  if (!c.alt.trim()) add("warn", "Write alt text before posting.", "captions.alt");
  return out;
}

export function checkPost(slides: Slide[], captions: Captions, channels: string[]): Issue[] {
  return [...slides.flatMap((s, i) => checkSlide(s, i, slides.length)), ...checkCaptions(captions, channels)];
}
