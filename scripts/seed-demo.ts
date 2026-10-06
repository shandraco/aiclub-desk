/**
 * Sample data for LOCAL DEVELOPMENT ONLY, so the home page, calendar and events look populated:
 *
 *   pnpm seed:demo
 *
 * Creates (only if absent) 3 rooms, 4 speakers, 2 partners, 4 upcoming events over the next
 * 5 weeks and 1 past event, each with its post plan in varied states, authored by user "ada"
 * and reviewed by "ben". Every record's name or title starts with "[Sample]" so nobody mistakes
 * it for club data. Refuses to run against Neon (production).
 *
 * Imports only pure modules: no "server-only", no Next.
 */
import { Pool } from "pg";
import type { PlanStep } from "../lib/brand/presets";
import { planDates } from "../lib/planning";
import { emptyCaptions, slideForEvent, type EventContext } from "../lib/posts/factory";
import { addDays, fromZoned, parseDayKey, todayKey } from "../lib/time";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  process.exit(1);
}
const host = new URL(url).hostname;
if (host.endsWith(".neon.tech") || process.env.VERCEL_ENV === "production") {
  console.error(`Refusing to seed sample data into ${host}: this script is for local development only.`);
  process.exit(1);
}

const S = "[Sample]";
const pool = new Pool({ connectionString: url, max: 1 });
const q = async <T = Record<string, unknown>>(text: string, values: unknown[] = []) => (await pool.query(text, values)).rows as T[];

async function userId(username: string): Promise<string | null> {
  const [r] = await q<{ id: string }>("select id from users where username = $1", [username]);
  return r?.id ?? null;
}

const ada = await userId("ada");
if (!ada) {
  console.error('No user "ada". Create one first: pnpm admin:create ada "Ada"');
  await pool.end();
  process.exit(1);
}
const ben = (await userId("ben")) ?? ada;

async function ensure(table: "rooms" | "speakers" | "partners", name: string, cols: Record<string, unknown>): Promise<string> {
  const [found] = await q<{ id: string }>(`select id from ${table} where name = $1 limit 1`, [name]);
  if (found) return found.id;
  const keys = ["name", ...Object.keys(cols)];
  const vals = [name, ...Object.values(cols)];
  const [row] = await q<{ id: string }>(`insert into ${table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, vals);
  return row!.id;
}

const rooms = {
  rsc: { id: await ensure("rooms", `${S} Rhatigan Student Center 233`, { short: "RSC 233" }), name: `${S} Rhatigan Student Center 233`, short: "RSC 233" },
  jab: { id: await ensure("rooms", `${S} Jabara Hall 126`, { short: "JH 126" }), name: `${S} Jabara Hall 126`, short: "JH 126" },
  lib: { id: await ensure("rooms", `${S} Ablah Library 310`, { short: "Ablah 310" }), name: `${S} Ablah Library 310`, short: "Ablah 310" },
};
const speakerDefs = [
  { name: `${S} Dana Whitfield`, role: "Data lead · Example Aviation" },
  { name: `${S} Marcus Oyelaran`, role: "ML engineer · Example Health" },
  { name: `${S} Priya Raman`, role: "Professor · Example Dept." },
  { name: `${S} Leo Hartmann`, role: "Founder · Example Startup" },
];
const speakers: { id: string; name: string; role: string }[] = [];
for (const d of speakerDefs) speakers.push({ id: await ensure("speakers", d.name, { role: d.role }), ...d });
const partnerDefs = [`${S} Example Labs`, `${S} Example Robotics Club`];
const partners: { id: string; name: string }[] = [];
for (const n of partnerDefs) partners.push({ id: await ensure("partners", n, {}), name: n });

type Status = "draft" | "in_review" | "changes_requested" | "approved" | "posted";
interface Def {
  title: string;
  preset: string;
  seriesLabel: string;
  summary: string;
  day: number; // days from today
  hour: number;
  hours: number;
  room: (typeof rooms)[keyof typeof rooms];
  speakers: number[];
  partners: number[];
  rsvps?: number;
  attendance?: number;
  /** Status per plan kind; a kind left out has no post (a gap). */
  posts: Partial<Record<PlanStep["kind"], Status>>;
}

const today = todayKey();
const defs: Def[] = [
  {
    title: `${S} Cleaning messy data with prompts`,
    preset: "workshop",
    seriesLabel: "Workshop · 01",
    summary: "Bring a spreadsheet; leave with a repeatable cleanup prompt.",
    day: -9,
    hour: 18,
    hours: 2,
    room: rooms.jab,
    speakers: [],
    partners: [],
    rsvps: 42,
    attendance: 31,
    posts: { announce: "posted", linkedin: "posted", reminder: "posted", day_of: "posted" },
  },
  {
    title: `${S} How a data team ships a model`,
    preset: "speaker-series",
    seriesLabel: "Speaker series · 01",
    summary: "Two practitioners walk through one model from notebook to production.",
    day: 3,
    hour: 18,
    hours: 1,
    room: rooms.rsc,
    speakers: [0, 1],
    partners: [],
    posts: { announce: "posted", linkedin: "approved", reminder: "in_review", day_of: "draft", recap: "draft" },
  },
  {
    title: `${S} Build a study bot in an hour`,
    preset: "workshop",
    seriesLabel: "Workshop · 02",
    summary: "A hands-on hour: retrieval over your own class notes.",
    day: 10,
    hour: 17,
    hours: 2,
    room: rooms.lib,
    speakers: [],
    partners: [],
    posts: { announce: "changes_requested", linkedin: "draft", day_of: "draft", recap: "draft" },
  },
  {
    title: `${S} Robots that see`,
    preset: "partner",
    seriesLabel: "Partner event",
    summary: "A computer vision night co-hosted with the robotics club.",
    day: 18,
    hour: 18,
    hours: 2,
    room: rooms.rsc,
    speakers: [3],
    partners: [0, 1],
    posts: { announce: "in_review", linkedin: "draft", day_of: "draft", recap: "draft" },
  },
  {
    title: `${S} Data centers and the water question`,
    preset: "open-floor",
    seriesLabel: "Open floor · 01",
    summary: "Both sides of the data center water debate, with time for questions.",
    day: 33,
    hour: 18,
    hours: 1,
    room: rooms.jab,
    speakers: [2],
    partners: [],
    posts: { announce: "draft", linkedin: "draft", reminder: "draft", day_of: "draft", recap: "draft" },
  },
];

let made = 0;
for (const d of defs) {
  const [exists] = await q<{ id: string }>("select id from events where title = $1 limit 1", [d.title]);
  if (exists) continue;
  const k = parseDayKey(addDays(today, d.day));
  const startsAt = fromZoned(k.year, k.month, k.day, d.hour, 0);
  const endsAt = fromZoned(k.year, k.month, k.day, d.hour + d.hours, 0);
  const [ev] = await q<{ id: string }>(
    `insert into events (title, preset, series_label, summary, starts_at, ends_at, room_id, rsvp_url, rsvps, attendance, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [d.title, d.preset, d.seriesLabel, d.summary, startsAt, endsAt, d.room.id, "https://example.com/rsvp", d.rsvps ?? null, d.attendance ?? null, ada],
  );
  const id = ev!.id;
  for (const [i, n] of d.speakers.entries()) await q("insert into event_speakers (event_id, speaker_id, sort) values ($1, $2, $3)", [id, speakers[n]!.id, i]);
  for (const [i, n] of d.partners.entries()) await q("insert into event_partners (event_id, partner_id, sort) values ($1, $2, $3)", [id, partners[n]!.id, i]);

  const ctx: EventContext = {
    id,
    title: d.title,
    preset: d.preset,
    seriesLabel: d.seriesLabel,
    summary: d.summary,
    startsAt,
    endsAt,
    place: "",
    rsvpUrl: "https://example.com/rsvp",
    room: { name: d.room.name, short: d.room.short },
    speakers: d.speakers.map((n) => ({ id: speakers[n]!.id, name: speakers[n]!.name.replace(`${S} `, ""), role: speakers[n]!.role, photo: null })),
    partners: d.partners.map((n) => ({ id: partners[n]!.id, name: partners[n]!.name, logo: null, tone: "original" as const })),
    rsvps: d.rsvps ?? null,
    attendance: d.attendance ?? null,
  };

  for (const p of planDates(startsAt)) {
    const status = d.posts[p.step.kind];
    if (!status) continue;
    const slide = slideForEvent(ctx, p.step.template, p.step.kind);
    const captions = status === "draft" ? emptyCaptions() : { linkedin: `${S} ${d.summary}`, instagram: `${S} ${d.summary}`, alt: `${S} Graphic for ${d.title}.` };
    const approved = status === "approved" || status === "posted";
    const [post] = await q<{ id: string }>(
      `insert into posts (event_id, kind, preset, slides, captions, formats, channels, status, scheduled_for, author_id, updated_by, reviewer_id, approved_by, approved_at, checklist, posted_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12, $13, $14, $15) returning id`,
      [
        id,
        p.step.kind,
        d.preset,
        JSON.stringify([slide]),
        JSON.stringify(captions),
        p.step.formats,
        p.step.channels,
        status,
        p.at,
        ada,
        status === "draft" ? null : ben,
        approved ? ben : null,
        approved ? new Date(p.at.getTime() - 86_400_000) : null,
        JSON.stringify({ facts: approved, tagged: approved, consent: approved }),
        status === "posted" ? p.at : null,
      ],
    );
    await q("insert into post_activity (post_id, actor_id, action, body) values ($1, $2, 'created', '')", [post!.id, ada]);
    if (status === "changes_requested") await q("insert into post_activity (post_id, actor_id, action, body) values ($1, $2, 'changes_requested', $3)", [post!.id, ben, `${S} Swap the room to the new one, please.`]);
  }
  made++;
}

await pool.end();
console.log(made ? `Added ${made} sample events with their posts, marked "${S}".` : `Sample data is already there; nothing added.`);
