import type { Metadata } from "next";
import { and, asc, count, isNotNull, isNull, sql } from "drizzle-orm";
import { can } from "@/lib/auth/rules";
import { requireUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { ActionButton } from "@/lib/team/ui/ActionButton";
import { setArchived } from "../actions";
import { contains, listParams } from "../query";
import { Toolbar } from "../Toolbar";
import { RoomEditButton } from "./RoomEditor";
import styles from "../library.module.css";

export const metadata: Metadata = { title: "Rooms" };

export default async function RoomsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { q, archived } = listParams(await searchParams);
  const used = sql<number>`(select count(*)::int from ${schema.events} where ${schema.events.roomId} = ${schema.rooms.id})`;
  const [rows, [arch]] = await Promise.all([
    db()
      .select({ r: schema.rooms, used })
      .from(schema.rooms)
      .where(and(archived ? isNotNull(schema.rooms.archivedAt) : isNull(schema.rooms.archivedAt), contains(q, [schema.rooms.name, schema.rooms.short])))
      .orderBy(asc(schema.rooms.name)),
    db().select({ n: count() }).from(schema.rooms).where(isNotNull(schema.rooms.archivedAt)),
  ]);
  const mayArchive = can(user.role, "library.archive");

  return (
    <section className="panel" aria-labelledby="rooms-h">
      <h2 id="rooms-h" className="visually-hidden">Rooms</h2>
      <Toolbar base="/library/rooms" q={q} archived={archived} noun="rooms" archivedCount={arch?.n ?? 0}>
        {!archived ? <RoomEditButton /> : null}
      </Toolbar>
      {rows.length === 0 ? (
        q ? (
          <div className="empty"><strong>No rooms match “{q}”.</strong>Try the building name or the short form, like RSC.</div>
        ) : archived ? (
          <div className="empty"><strong>Nothing archived.</strong>Archived rooms drop out of the event form but stay on past events.</div>
        ) : (
          <div className="empty">
            <strong>Add the rooms you meet in.</strong>
            Each room has a full name for captions and a short form for the graphic’s data strip, so “RSC 233” is spelled the same way on every post.
          </div>
        )
      ) : (
        <div className={styles.tableWrap}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Room</th>
                <th scope="col">On graphics</th>
                <th scope="col">Notes</th>
                <th scope="col" className="num">Events</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, used: n }) => (
                <tr key={r.id}>
                  <th scope="row" className={styles.rowHead}>{r.name}</th>
                  <td className="figures">{r.short}</td>
                  <td className="muted">{r.notes || "—"}</td>
                  <td className="num">{n}</td>
                  <td>
                    <div className={`btn-row ${styles.cellActions}`}>
                      {!archived ? <RoomEditButton room={{ id: r.id, name: r.name, short: r.short, notes: r.notes }} /> : null}
                      {mayArchive ? (
                        <ActionButton action={setArchived} fields={{ kind: "room", id: r.id, archive: archived ? "0" : "1" }} className="btn btn-s btn-quiet" label={`${archived ? "Restore" : "Archive"} ${r.name}`}>
                          {archived ? "Restore" : "Archive"}
                        </ActionButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
