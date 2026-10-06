/** The rail's icons: 20px, 1.5px strokes, drawn for this desk. Decorative; labels carry meaning. */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const icons = {
  week: (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...P}><rect x="2.5" y="4" width="15" height="12.5" rx="1.5" /><path d="M7.5 4v12.5M12.5 4v12.5M2.5 7.5h15" /></svg>
  ),
  calendar: (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...P}><rect x="2.5" y="4" width="15" height="13" rx="1.5" /><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3M6 11h1M9.5 11h1M13 11h1M6 14h1M9.5 14h1" /></svg>
  ),
  events: (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...P}><path d="M10 2.5c0 4 3.5 7.5 7.5 7.5-4 0-7.5 3.5-7.5 7.5 0-4-3.5-7.5-7.5-7.5 4 0 7.5-3.5 7.5-7.5Z" /></svg>
  ),
  posts: (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...P}><rect x="5.5" y="2.5" width="10" height="12.5" /><path d="M3 5.5v12h10" /></svg>
  ),
  templates: (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...P}><rect x="2.5" y="2.5" width="6.5" height="8" /><rect x="11" y="2.5" width="6.5" height="5" /><rect x="2.5" y="12.5" width="6.5" height="5" /><rect x="11" y="9.5" width="6.5" height="8" /></svg>
  ),
  library: (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...P}><circle cx="7" cy="7" r="2.5" /><path d="M2.5 15.5c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4" /><rect x="12" y="4.5" width="5.5" height="5.5" /><path d="M12 14h5.5M12 16.5h3.5" /></svg>
  ),
  results: (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...P}><path d="M2.5 17.5h15M5 14.5v-5M10 14.5V4.5M15 14.5v-8" /></svg>
  ),
  team: (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...P}><circle cx="7.5" cy="7" r="2.75" /><path d="M2.5 16.5c.5-3 2.4-4.5 5-4.5s4.5 1.5 5 4.5" /><path d="M13 4.6a2.6 2.6 0 0 1 0 5M14.5 12.2c1.7.5 2.7 2 3 4.3" /></svg>
  ),
  search: (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...P}><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4.5 4.5" /></svg>
  ),
  plus: (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...P}><path d="M10 4v12M4 10h12" /></svg>
  ),
} as const;

export type IconName = keyof typeof icons;
