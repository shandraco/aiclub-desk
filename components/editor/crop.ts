import { clamp } from "./slots";

/**
 * Crop geometry, ported from the original desk. A frame draws its photo with
 * object-fit: cover, object-position x% y%, then scale(zoom) around that same point.
 * The crop box is the visible rectangle in image pixels; these convert between the two.
 */
export interface Geom {
  /** Frame size in canvas pixels. */
  W: number;
  H: number;
  /** Image natural size. */
  iw: number;
  ih: number;
  /** Cover scale and the covered image size. */
  s: number;
  RW: number;
  RH: number;
}

export interface Box {
  l: number;
  t: number;
  w: number;
  h: number;
}

export interface Focus {
  x: number;
  y: number;
  zoom: number;
}

export function geom(frame: { w: number; h: number }, iw: number, ih: number): Geom {
  const s = Math.max(frame.w / iw, frame.h / ih);
  return { W: frame.w, H: frame.h, iw, ih, s, RW: iw * s, RH: ih * s };
}

export function boxFromFocus(g: Geom, f: Partial<Focus>): Box {
  const z = clamp(f.zoom ?? 1, 1, 3);
  const x = f.x ?? 50;
  const y = f.y ?? 50;
  return {
    w: g.W / (z * g.s),
    h: g.H / (z * g.s),
    l: ((g.W * x) / 100 * (1 - 1 / z) + ((g.RW - g.W) * x) / 100) / g.s,
    t: ((g.H * y) / 100 * (1 - 1 / z) + ((g.RH - g.H) * y) / 100) / g.s,
  };
}

export function focusFromBox(g: Geom, b: Box): Focus {
  const zoom = clamp(g.W / (b.w * g.s), 1, 3);
  const dx = g.RW - g.W / zoom;
  const dy = g.RH - g.H / zoom;
  return {
    zoom,
    x: dx > 0.5 ? clamp((100 * b.l * g.s) / dx, 0, 100) : 50,
    y: dy > 0.5 ? clamp((100 * b.t * g.s) / dy, 0, 100) : 50,
  };
}

/** Moves a box by (dx, dy) image pixels, kept inside the image. */
export function moveBox(g: Geom, b: Box, dx: number, dy: number): Box {
  return { ...b, l: clamp(b.l + dx, 0, Math.max(0, g.iw - b.w)), t: clamp(b.t + dy, 0, Math.max(0, g.ih - b.h)) };
}

/**
 * Resizes from a corner ("tl", "tr", "bl", "br") to the pointer at (px, py) in image pixels,
 * keeping the frame's shape and the opposite corner fixed. Never smaller than zoom 3.
 */
export function resizeBox(g: Geom, start: Box, corner: string, px: number, py: number): Box {
  const a = g.W / g.H;
  const right = corner[1] === "r";
  const bottom = corner[0] === "b";
  const ax = right ? start.l : start.l + start.w;
  const ay = bottom ? start.t : start.t + start.h;
  let w = Math.max(Math.abs(px - ax), Math.abs(py - ay) * a);
  const maxW = Math.min(g.W / g.s, right ? g.iw - ax : ax, (bottom ? g.ih - ay : ay) * a);
  const minW = g.W / (3 * g.s);
  w = Math.max(Math.min(minW, maxW), Math.min(w, maxW));
  const h = w / a;
  return { w, h, l: right ? ax : ax - w, t: bottom ? ay : ay - h };
}
