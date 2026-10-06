import "server-only";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/lib/db";
import type { EventContext } from "@/lib/posts/factory";

/** An event with its room, speakers (with photo URLs and crops) and partners (with logo URLs). */
export async function loadEventContext(eventId: string): Promise<EventContext | null> {
  const d = db();
  const [ev] = await d
    .select({ event: schema.events, room: { name: schema.rooms.name, short: schema.rooms.short } })
    .from(schema.events)
    .leftJoin(schema.rooms, eq(schema.rooms.id, schema.events.roomId))
    .where(eq(schema.events.id, eventId))
    .limit(1);
  if (!ev) return null;

  const photo = alias(schema.assets, "photo");
  const speakers = await d
    .select({ s: schema.speakers, url: photo.url, w: photo.width, h: photo.height, assetId: photo.id })
    .from(schema.eventSpeakers)
    .innerJoin(schema.speakers, eq(schema.speakers.id, schema.eventSpeakers.speakerId))
    .leftJoin(photo, eq(photo.id, schema.speakers.photoId))
    .where(eq(schema.eventSpeakers.eventId, eventId))
    .orderBy(asc(schema.eventSpeakers.sort));

  const logo = alias(schema.assets, "logo");
  const partners = await d
    .select({ p: schema.partners, url: logo.url })
    .from(schema.eventPartners)
    .innerJoin(schema.partners, eq(schema.partners.id, schema.eventPartners.partnerId))
    .leftJoin(logo, eq(logo.id, schema.partners.logoId))
    .where(eq(schema.eventPartners.eventId, eventId))
    .orderBy(asc(schema.eventPartners.sort));

  const e = ev.event;
  return {
    id: e.id,
    title: e.title,
    preset: e.preset,
    seriesLabel: e.seriesLabel,
    summary: e.summary,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    place: e.place,
    rsvpUrl: e.rsvpUrl,
    room: ev.room?.name ? { name: ev.room.name, short: ev.room.short ?? ev.room.name } : null,
    rsvps: e.rsvps,
    attendance: e.attendance,
    speakers: speakers.map(({ s, url, w, h, assetId }) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      photo: url ? { src: url, x: s.photoCrop?.x ?? 50, y: s.photoCrop?.y ?? 50, zoom: s.photoCrop?.zoom ?? 1, w: w ?? undefined, h: h ?? undefined, assetId: assetId ?? undefined, alt: `Photo of ${s.name}` } : null,
    })),
    partners: partners.map(({ p, url }) => ({ id: p.id, name: p.name, logo: url, tone: p.logoTone })),
  };
}
