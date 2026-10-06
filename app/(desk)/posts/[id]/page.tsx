import { and, asc, eq, gt, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import type { ActivityItem, Channel, EditorPost, LibPartner, LibSpeaker } from "@/components/editor/types";
import { getUser } from "@/lib/auth/session";
import { approvers, namesById } from "@/lib/data/users";
import { db, schema } from "@/lib/db";
import type { Format } from "@/lib/posts/types";
import { uploadMode } from "@/lib/uploads/mode";

export const metadata: Metadata = { title: "Edit post" };

/** Presence rows newer than this count as "also editing". */
const activeSince = () => new Date(Date.now() - 60_000);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const d = db();
  const [row] = await d
    .select({ post: schema.posts, eventTitle: schema.events.title })
    .from(schema.posts)
    .leftJoin(schema.events, eq(schema.events.id, schema.posts.eventId))
    .where(eq(schema.posts.id, id))
    .limit(1);
  if (!row) notFound();
  const p = row.post;

  const photo = alias(schema.assets, "photo");
  const logo = alias(schema.assets, "logo");
  const [names, people, activity, speakers, partners, here] = await Promise.all([
    namesById(),
    approvers(),
    d.select().from(schema.postActivity).where(eq(schema.postActivity.postId, id)).orderBy(asc(schema.postActivity.createdAt)),
    d
      .select({ s: schema.speakers, url: photo.url, w: photo.width, h: photo.height, assetId: photo.id })
      .from(schema.speakers)
      .leftJoin(photo, eq(photo.id, schema.speakers.photoId))
      .where(isNull(schema.speakers.archivedAt))
      .orderBy(asc(schema.speakers.name)),
    d
      .select({ p: schema.partners, url: logo.url })
      .from(schema.partners)
      .leftJoin(logo, eq(logo.id, schema.partners.logoId))
      .where(isNull(schema.partners.archivedAt))
      .orderBy(asc(schema.partners.name)),
    d
      .select({ id: schema.users.id, name: schema.users.displayName })
      .from(schema.presence)
      .innerJoin(schema.users, eq(schema.users.id, schema.presence.userId))
      .where(and(eq(schema.presence.postId, id), ne(schema.presence.userId, user.id), gt(schema.presence.seenAt, activeSince()))),
  ]);

  const post: EditorPost = {
    id: p.id,
    eventId: p.eventId,
    eventTitle: row.eventTitle ?? null,
    kind: p.kind,
    preset: p.preset,
    slides: p.slides,
    captions: p.captions,
    formats: p.formats as Format[],
    channels: p.channels as Channel[],
    status: p.status,
    scheduledFor: p.scheduledFor,
    authorId: p.authorId,
    reviewerId: p.reviewerId,
    approvedBy: p.approvedBy,
    approvedAt: p.approvedAt,
    updatedBy: p.updatedBy,
    postedAt: p.postedAt,
    postedUrls: p.postedUrls,
    checklist: p.checklist,
    version: p.version,
    updatedAt: p.updatedAt,
  };

  const libSpeakers: LibSpeaker[] = speakers.map(({ s, url, w, h, assetId }) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    photo: url
      ? { src: url, x: s.photoCrop?.x ?? 50, y: s.photoCrop?.y ?? 50, zoom: s.photoCrop?.zoom ?? 1, w: w ?? undefined, h: h ?? undefined, assetId: assetId ?? undefined, alt: `Photo of ${s.name}` }
      : null,
  }));
  const libPartners: LibPartner[] = partners.map(({ p: x, url }) => ({ id: x.id, name: x.name, logo: url, tone: x.logoTone }));
  const timeline: ActivityItem[] = activity.map((a) => ({
    id: a.id,
    actorName: (a.actorId && names.get(a.actorId)) || "Someone",
    action: a.action,
    body: a.body,
    createdAt: a.createdAt,
  }));

  return (
    <Editor
      key={p.id}
      post={post}
      me={{ id: user.id, displayName: user.displayName, role: user.role }}
      names={Object.fromEntries(names)}
      approvers={people.map((x) => ({ id: x.id, displayName: x.displayName }))}
      activity={timeline}
      speakers={libSpeakers}
      partners={libPartners}
      uploadMode={uploadMode()}
      present={here}
    />
  );
}
