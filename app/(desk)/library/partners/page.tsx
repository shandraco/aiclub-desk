import type { Metadata } from "next";
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { can } from "@/lib/auth/rules";
import { requireUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { linkedInLabel } from "@/lib/team/handles";
import { ActionButton } from "@/lib/team/ui/ActionButton";
import { uploadMode } from "@/lib/uploads/mode";
import { setArchived } from "../actions";
import { contains, listParams } from "../query";
import { Toolbar } from "../Toolbar";
import { LogoGrounds } from "./LogoGrounds";
import { PartnerEditButton } from "./PartnerEditor";
import styles from "../library.module.css";

export const metadata: Metadata = { title: "Partners" };

const TONE_LABEL = { original: "Original colours", white: "All white", black: "All black" } as const;

export default async function PartnersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { q, archived } = listParams(await searchParams);
  const logo = alias(schema.assets, "logo");
  const used = sql<number>`(select count(*)::int from ${schema.eventPartners} where ${schema.eventPartners.partnerId} = ${schema.partners.id})`;
  const [rows, [arch]] = await Promise.all([
    db()
      .select({ p: schema.partners, url: logo.url, used })
      .from(schema.partners)
      .leftJoin(logo, eq(logo.id, schema.partners.logoId))
      .where(and(archived ? isNotNull(schema.partners.archivedAt) : isNull(schema.partners.archivedAt), contains(q, [schema.partners.name, schema.partners.instagram])))
      .orderBy(asc(schema.partners.name)),
    db().select({ n: count() }).from(schema.partners).where(isNotNull(schema.partners.archivedAt)),
  ]);
  const mode = uploadMode();
  const mayArchive = can(user.role, "library.archive");

  return (
    <section className="panel" aria-labelledby="partners-h">
      <h2 id="partners-h" className="visually-hidden">Partners</h2>
      <Toolbar base="/library/partners" q={q} archived={archived} noun="partners" archivedCount={arch?.n ?? 0}>
        {!archived ? <PartnerEditButton mode={mode} /> : null}
      </Toolbar>
      {rows.length === 0 ? (
        q ? (
          <div className="empty"><strong>No partners match “{q}”.</strong>Check the spelling, or search by Instagram handle.</div>
        ) : archived ? (
          <div className="empty"><strong>Nothing archived.</strong>Archived partners drop out of the pickers but stay on the posts that used them.</div>
        ) : (
          <div className="empty">
            <strong>Add a partner’s logo once.</strong>
            Upload it with a transparent background and pick whether it shows in colour, white or black. Every co-hosted event then puts the right version in the lockup, on either ground.
          </div>
        )
      ) : (
        <ul className={`ruled ${styles.list}`}>
          {rows.map((r) => (
            <li key={r.p.id} className={`${styles.row} ${styles.partnerRow}`}>
              <LogoGrounds url={r.url} tone={r.p.logoTone} name={r.p.name} small />
              <div className={styles.main}>
                <h3 className={styles.name}>{r.p.name}</h3>
                <p className={styles.missing}>{r.url ? `${TONE_LABEL[r.p.logoTone]} by default` : "No logo yet."}</p>
                {r.p.notes ? <p className={styles.notes}>{r.p.notes}</p> : null}
              </div>
              <dl className={styles.facts}>
                <div><dt>Instagram</dt><dd>{r.p.instagram ? <a href={`https://www.instagram.com/${r.p.instagram}/`} rel="noreferrer" target="_blank">@{r.p.instagram}</a> : <span className="muted">Not set</span>}</dd></div>
                <div><dt>LinkedIn</dt><dd>{r.p.linkedin ? <a href={r.p.linkedin} rel="noreferrer" target="_blank">{linkedInLabel(r.p.linkedin)}</a> : <span className="muted">Not set</span>}</dd></div>
                <div><dt>Events</dt><dd>{r.used === 0 ? "Not used yet" : r.used === 1 ? "1 event" : `${r.used} events`}</dd></div>
              </dl>
              <div className={styles.actions}>
                {!archived ? (
                  <PartnerEditButton mode={mode} partner={{ id: r.p.id, name: r.p.name, instagram: r.p.instagram, linkedin: r.p.linkedin, notes: r.p.notes, tone: r.p.logoTone, logo: r.url && r.p.logoId ? { id: r.p.logoId, url: r.url } : null }} />
                ) : null}
                {mayArchive ? (
                  <ActionButton action={setArchived} fields={{ kind: "partner", id: r.p.id, archive: archived ? "0" : "1" }} className="btn btn-s btn-quiet" label={`${archived ? "Restore" : "Archive"} ${r.p.name}`}>
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
