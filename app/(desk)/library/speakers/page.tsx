import type { Metadata } from "next";
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rules";
import { db, schema } from "@/lib/db";
import { linkedInLabel } from "@/lib/team/handles";
import { uploadMode } from "@/lib/uploads/mode";
import { Photo } from "@/components/post/PostCanvas";
import { ActionButton } from "@/lib/team/ui/ActionButton";
import { setArchived } from "../actions";
import { contains, listParams } from "../query";
import { Toolbar } from "../Toolbar";
import { SpeakerEditButton, type SpeakerDraft } from "./SpeakerEditor";
import styles from "../library.module.css";

export const metadata: Metadata = { title: "Speakers" };

export default async function SpeakersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { q, archived } = listParams(await searchParams);
  const photo = alias(schema.assets, "photo");
  const used = sql<number>`(select count(*)::int from ${schema.eventSpeakers} where ${schema.eventSpeakers.speakerId} = ${schema.speakers.id})`;
  const [rows, [arch]] = await Promise.all([
    db()
      .select({ s: schema.speakers, url: photo.url, w: photo.width, h: photo.height, used })
      .from(schema.speakers)
      .leftJoin(photo, eq(photo.id, schema.speakers.photoId))
      .where(and(archived ? isNotNull(schema.speakers.archivedAt) : isNull(schema.speakers.archivedAt), contains(q, [schema.speakers.name, schema.speakers.role, schema.speakers.instagram])))
      .orderBy(asc(schema.speakers.name)),
    db().select({ n: count() }).from(schema.speakers).where(isNotNull(schema.speakers.archivedAt)),
  ]);
  const mode = uploadMode();
  const mayArchive = can(user.role, "library.archive");

  const draft = (r: (typeof rows)[number]): SpeakerDraft => ({
    id: r.s.id,
    name: r.s.name,
    role: r.s.role,
    instagram: r.s.instagram,
    linkedin: r.s.linkedin,
    notes: r.s.notes,
    photo: r.url ? { id: r.s.photoId!, url: r.url, width: r.w ?? 0, height: r.h ?? 0 } : null,
    crop: r.s.photoCrop ?? { x: 50, y: 50, zoom: 1 },
  });

  return (
    <section className="panel" aria-labelledby="speakers-h">
      <h2 id="speakers-h" className="visually-hidden">Speakers</h2>
      <Toolbar base="/library/speakers" q={q} archived={archived} noun="speakers" archivedCount={arch?.n ?? 0}>
        {!archived ? <SpeakerEditButton mode={mode} /> : null}
      </Toolbar>

      {rows.length === 0 ? (
        q ? (
          <div className="empty">
            <strong>No speakers match “{q}”.</strong>
            Check the spelling, or search by organisation or Instagram handle.
          </div>
        ) : archived ? (
          <div className="empty">
            <strong>Nothing archived.</strong>
            Archived speakers drop out of the pickers but stay on the posts that used them.
          </div>
        ) : (
          <div className="empty">
            <strong>Add your first speaker.</strong>
            Upload their approved photo and type their title once. Every speaker post, reminder and recap then pulls the same photo, crop and wording, so nobody hunts through email for it again.
          </div>
        )
      ) : (
        <ul className={`ruled ${styles.list}`}>
          {rows.map((r) => (
            <li key={r.s.id} className={styles.row}>
              <div className={styles.photo}>
                <Photo
                  img={r.url ? { src: r.url, x: r.s.photoCrop?.x ?? 50, y: r.s.photoCrop?.y ?? 50, zoom: r.s.photoCrop?.zoom ?? 1 } : null}
                  slot="list"
                  bw
                  label=""
                  alt={`Photo of ${r.s.name}`}
                />
              </div>
              <div className={styles.main}>
                <h3 className={styles.name}>{r.s.name}</h3>
                {r.s.role ? <p className={styles.role}>{r.s.role}</p> : <p className={styles.missing}>No title yet. Graphics show only the name.</p>}
                {!r.url ? <p className={styles.missing}>No photo yet.</p> : null}
                {r.s.notes ? <p className={styles.notes}>{r.s.notes}</p> : null}
              </div>
              <dl className={styles.facts}>
                <div>
                  <dt>Instagram</dt>
                  <dd>{r.s.instagram ? <a href={`https://www.instagram.com/${r.s.instagram}/`} rel="noreferrer" target="_blank">@{r.s.instagram}</a> : <span className="muted">Not set</span>}</dd>
                </div>
                <div>
                  <dt>LinkedIn</dt>
                  <dd>{r.s.linkedin ? <a href={r.s.linkedin} rel="noreferrer" target="_blank">{linkedInLabel(r.s.linkedin)}</a> : <span className="muted">Not set</span>}</dd>
                </div>
                <div>
                  <dt>Events</dt>
                  <dd>{r.used === 0 ? "Not used yet" : r.used === 1 ? "1 event" : `${r.used} events`}</dd>
                </div>
              </dl>
              <div className={styles.actions}>
                {!archived ? <SpeakerEditButton mode={mode} speaker={draft(r)} /> : null}
                {mayArchive ? (
                  <ActionButton
                    action={setArchived}
                    fields={{ kind: "speaker", id: r.s.id, archive: archived ? "0" : "1" }}
                    className="btn btn-s btn-quiet"
                    label={`${archived ? "Restore" : "Archive"} ${r.s.name}`}
                  >
                    {archived ? "Restore" : "Archive"}
                  </ActionButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
