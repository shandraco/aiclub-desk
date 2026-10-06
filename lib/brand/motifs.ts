/**
 * Shapes taken from the club's mark (the wheat shock: leaves, chevrons, the "i" stem and the
 * gold spark), plus a seeded generator for the Field family. Pure and deterministic: the same
 * words always grow the same field, on the server, in the preview and in the exported PNG.
 */

/** The club's 4-point spark, in a 144 box. */
export const SPARK = "M72 0C72 32 112 72 144 72C112 72 72 112 72 144C72 112 32 72 0 72C32 72 72 32 72 0Z";

/** One leaf of the shock: a lens with a full outer curve and a flatter inner one, base at bottom-left, tip at top-right (box 130 x 120). */
export const LEAF = "M0 120C4 58 52 8 130 0C124 66 78 112 0 120Z";

/** One chevron of the shock (box 150 x 130), point down. */
export const CHEVRON = "M0 0H44L75 56L106 0H150L75 130Z";

/** The "i" stem (box 22 x 120), rounded ends. */
export const STEM = "M11 0C17 0 22 5 22 11V109C22 115 17 120 11 120C5 120 0 115 0 109V11C0 5 5 0 11 0Z";

/** FNV-1a 32-bit: a stable seed from any text. */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for drawing. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Stalk {
  /** SVG path of the stem. */
  d: string;
  /** Ear (head) of wheat: position, rotation (degrees, 0 = upright), length and width. */
  hx: number;
  hy: number;
  angle: number;
  length: number;
  width: number;
  opacity: number;
  stroke: number;
  gold: boolean;
}

export interface FieldDrawing {
  stalks: Stalk[];
  /** Where the spark sits: just above the tallest gold ear. */
  spark: { x: number; y: number; size: number };
}

/** A wheat ear pointing up from (0,0): a narrow lens with three awns. Rotate and translate per stalk. */
export function earPath(length: number, width: number): string {
  const L = length;
  const w = width / 2;
  return `M0 0C${w} ${-L * 0.25} ${w} ${-L * 0.75} 0 ${-L}C${-w} ${-L * 0.75} ${-w} ${-L * 0.25} 0 0Z`;
}
export function awnsPath(length: number): string {
  const L = length;
  return `M0 ${-L}l0 ${-L * 0.45}M0 ${-L * 0.9}l${L * 0.12} ${-L * 0.42}M0 ${-L * 0.9}l${-L * 0.12} ${-L * 0.42}`;
}

/**
 * A wheat field across the bottom of a canvas: a full-width band of thin stalks that lean
 * together in one wind (a seeded sum of sines), layered by depth so the back rows are fainter.
 * `top` is the highest an ear may reach (keeps the words clear). Seeded by the post's words.
 */
export function growField(text: string, width: number, height: number, top: number, density = 60): FieldDrawing {
  const rand = rng(seedFrom(text || "AI Club"));
  const gust = (rand() - 0.5) * 0.5; // the prevailing wind, one direction for the whole field
  const waves = Array.from({ length: 3 }, () => ({ f: 0.004 + rand() * 0.008, p: rand() * Math.PI * 2, a: 0.4 + rand() * 0.6 }));
  const wind = (x: number) => gust + (0.22 * waves.reduce((s, w) => s + w.a * Math.sin(x * w.f + w.p), 0)) / waves.length;
  const swell = Array.from({ length: 2 }, () => ({ f: 0.003 + rand() * 0.004, p: rand() * 6.28 }));
  const tallness = (x: number) => 0.86 + (0.14 * swell.reduce((s, w) => s + Math.sin(x * w.f + w.p), 0)) / swell.length;

  const n = Math.round((width / 100) * density);
  const base = height + 20;
  const room = base - top;
  const stalks: Stalk[] = [];
  for (let i = 0; i < n; i++) {
    const depth = rand(); // 0 = far back, 1 = front
    const x = -30 + rand() * (width + 60);
    const h = room * tallness(x) * (0.7 + depth * 0.22 + rand() * 0.08) * (1 - (1 - depth) * 0.12);
    const lean = wind(x) * h * 0.55 + (rand() - 0.5) * 10;
    const ex = x + lean;
    const ey = base - h;
    const cx = x + lean * 0.1;
    const cy = base - h * 0.6;
    const angle = (Math.atan2(ex - cx, cy - ey) * 180) / Math.PI;
    stalks.push({
      d: `M${x.toFixed(1)} ${base}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`,
      hx: ex,
      hy: ey,
      angle,
      length: 26 + depth * 34 + rand() * 10,
      width: 6 + depth * 6,
      opacity: 0.08 + depth * 0.5,
      stroke: 0.6 + depth * 1.3,
      gold: rand() < 0.03,
    });
  }
  // Far rows first.
  stalks.sort((a, b) => a.opacity - b.opacity);
  const golds = stalks.filter((s) => s.gold);
  const tallest = (golds.length ? golds : stalks).reduce((m, s) => (s.hy < m.hy ? s : m));
  tallest.gold = true;
  tallest.opacity = 1;
  const rad = (tallest.angle * Math.PI) / 180;
  const tipX = tallest.hx + Math.sin(rad) * (tallest.length * 1.5);
  const tipY = tallest.hy - Math.cos(rad) * (tallest.length * 1.5);
  return { stalks, spark: { x: tipX, y: tipY - 36, size: 52 } };
}
