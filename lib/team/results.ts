/**
 * "What worked": plain sentences drawn only from numbers the officers typed in. A comparison
 * is made only when every group in it has at least MIN posts with reach recorded, and the
 * counts are always stated, so nobody reads a trend into one lucky post.
 */
export const MIN_PER_GROUP = 2;

export interface ResultPost {
  /** Series name, e.g. "Speaker Series"; null when the post has no event. */
  series: string | null;
  /** Kind label, e.g. "Announcement". */
  kind: string;
  /** Reach per channel; null where nobody typed a number. */
  reach: { channel: string; reach: number | null }[];
}

export interface EventTurnout {
  rsvps: number | null;
  attendance: number | null;
}

interface Group {
  name: string;
  n: number;
  avg: number;
}

function groups<T>(items: T[], key: (t: T) => string | null, value: (t: T) => number | null): Group[] {
  const m = new Map<string, number[]>();
  for (const it of items) {
    const k = key(it);
    const v = value(it);
    if (k === null || v === null) continue;
    m.set(k, [...(m.get(k) ?? []), v]);
  }
  return [...m.entries()]
    .filter(([, vs]) => vs.length >= MIN_PER_GROUP)
    .map(([name, vs]) => ({ name, n: vs.length, avg: Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) }))
    .sort((a, b) => b.avg - a.avg);
}

/** Total reach across channels for one post, or null if no channel has a number. */
export function postReach(p: ResultPost): number | null {
  const vs = p.reach.map((r) => r.reach).filter((v): v is number => v !== null);
  return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
}

const fmt = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** Highest average against lowest, with both counts. Null unless two groups qualify. */
function compare(gs: Group[], sentence: (hi: Group, lo: Group, verb: string) => string): string | null {
  if (gs.length < 2) return null;
  const hi = gs[0]!;
  const lo = gs[gs.length - 1]!;
  return sentence(hi, lo, hi.avg === lo.avg ? "matched" : "averaged") + ` (${hi.n} and ${plural(lo.n, "post")}).`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function whatWorked(posts: ResultPost[], events: EventTurnout[] = []): string[] {
  const out: string[] = [];

  const bySeries = compare(
    groups(posts, (p) => p.series, postReach),
    (hi, lo, verb) => `${hi.name} posts ${verb} ${fmt(hi.avg)} reach vs ${fmt(lo.avg)} for ${lo.name} posts`,
  );
  if (bySeries) out.push(bySeries);

  const byChannel = compare(
    groups(posts.flatMap((p) => p.reach), (r) => r.channel, (r) => r.reach),
    (hi, lo, verb) => `${cap(hi.name)} posts ${verb} ${fmt(hi.avg)} reach vs ${fmt(lo.avg)} on ${cap(lo.name)}`,
  );
  if (byChannel) out.push(byChannel);

  const byKind = compare(
    groups(posts, (p) => p.kind, postReach),
    (hi, lo, verb) => `${hi.name} posts ${verb} ${fmt(hi.avg)} reach vs ${fmt(lo.avg)} for ${lo.name.toLowerCase()} posts`,
  );
  if (byKind) out.push(byKind);

  const both = events.filter((e): e is { rsvps: number; attendance: number } => e.rsvps !== null && e.attendance !== null && e.rsvps > 0);
  if (both.length >= MIN_PER_GROUP) {
    const r = both.reduce((a, e) => a + e.rsvps, 0);
    const a = both.reduce((s, e) => s + e.attendance, 0);
    out.push(`Across ${both.length} events with both numbers, ${fmt(a)} people came for ${fmt(r)} RSVPs (${Math.round((a / r) * 100)}%).`);
  }
  return out;
}
