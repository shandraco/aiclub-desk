import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { can, ROLE_HELP, ROLE_LABEL } from "@/lib/auth/rules";
import { requireUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { ActionButton } from "@/lib/team/ui/ActionButton";
import { ago, fmtDate, fmtDateYear, relativeDay } from "@/lib/time";
import { revokeInvite, setDisabled } from "./actions";
import { InviteForm, ResetPasswordButton, RoleForm } from "./TeamControls";
import styles from "./team.module.css";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireUser();
  if (!can(me.role, "team.manage")) {
    return (
      <>
        <header className="page-head">
          <div>
            <h1>Team</h1>
          </div>
        </header>
        <div className="empty">
          <strong>Only admins manage the team.</strong>
          Ask an admin to invite someone, change a role or reset a password. You can change your own name and password on <Link href="/account">your account page</Link>.
        </div>
      </>
    );
  }

  const creator = alias(schema.users, "creator");
  const usedBy = alias(schema.users, "used_by_user");
  const [users, invites] = await Promise.all([
    db()
      .select({ id: schema.users.id, username: schema.users.username, displayName: schema.users.displayName, role: schema.users.role, disabledAt: schema.users.disabledAt, lastSeenAt: sql<Date | null>`greatest("users"."last_seen_at", (select max(s.last_used_at) from sessions s where s.user_id = "users"."id"))`.mapWith((v: string | null) => (v ? new Date(v) : null)), createdAt: schema.users.createdAt })
      .from(schema.users)
      .orderBy(sql`${schema.users.disabledAt} is not null`, asc(schema.users.displayName)),
    db()
      .select({ i: schema.invites, by: creator.displayName, usedByName: usedBy.displayName })
      .from(schema.invites)
      .leftJoin(creator, eq(creator.id, schema.invites.createdBy))
      .leftJoin(usedBy, eq(usedBy.id, schema.invites.usedBy))
      .orderBy(desc(schema.invites.createdAt))
      .limit(100),
  ]);
  const now = new Date();
  const pending = invites.filter(({ i }) => !i.usedAt && !i.revokedAt && i.expiresAt > now);
  const closed = invites.filter(({ i }) => i.usedAt || i.revokedAt || i.expiresAt <= now);
  const active = users.filter((u) => !u.disabledAt);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Team</h1>
          <p>Who can use the desk and what they can do. Changing someone’s role, turning their account off or resetting their password signs them out everywhere.</p>
        </div>
      </header>

      <section className="panel" aria-labelledby="people-h">
        <h2 id="people-h">
          People <small>{active.length} active{users.length > active.length ? `, ${users.length - active.length} turned off` : ""}</small>
        </h2>
        <div className={styles.scroll}>
          <table className={`table ${styles.people}`}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Last seen</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === me.id;
                const off = !!u.disabledAt;
                return (
                  <tr key={u.id} className={off ? styles.off : undefined}>
                    <th scope="row" className={styles.person}>
                      <span className={styles.name}>{u.displayName}{self ? <span className="muted"> (you)</span> : null}</span>
                      <span className="muted">@{u.username}</span>
                      {off ? <span className={styles.offWord}>Turned off {fmtDate(u.disabledAt!)}</span> : null}
                    </th>
                    <td>
                      {off ? ROLE_LABEL[u.role] : <RoleForm userId={u.id} name={u.displayName} role={u.role} self={self} />}
                    </td>
                    <td className={styles.nowrap}><span className={styles.mLabel}>Last seen </span>{u.lastSeenAt ? ago(u.lastSeenAt, now) : <span className="muted">Never</span>}</td>
                    <td>
                      <div className={styles.rowActions}>
                        {!self && !off ? <ResetPasswordButton userId={u.id} name={u.displayName} username={u.username} /> : null}
                        {!self ? (
                          <ActionButton
                            action={setDisabled}
                            fields={{ userId: u.id, disable: off ? "0" : "1" }}
                            className={off ? "btn btn-s" : "btn btn-s btn-quiet btn-danger"}
                            label={`${off ? "Turn on" : "Turn off"} ${u.displayName}’s account`}
                            confirm={off ? undefined : `Turn off ${u.displayName}’s account? They’re signed out at once and can’t sign in until an admin turns it back on. Their posts stay.`}
                          >
                            {off ? "Turn on" : "Turn off"}
                          </ActionButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="invite-h">
        <h2 id="invite-h">Invite someone</h2>
        <div className={styles.inviteGrid}>
          <InviteForm help={ROLE_HELP} />
          <div>
            <h3 className={styles.sub}>
              Waiting to be used <span className="muted">{pending.length}</span>
            </h3>
            {pending.length === 0 ? (
              <p className="muted">No open invites. A link you create appears here until it’s used, cancelled or expires.</p>
            ) : (
              <ul className={`ruled ${styles.invites}`}>
                {pending.map(({ i, by }) => (
                  <li key={i.id}>
                    <div>
                      <b>{i.label}</b> <span className="muted">as {ROLE_LABEL[i.role].toLowerCase()}</span>
                      <p className="muted">
                        By {by ?? "a former admin"} {ago(i.createdAt, now)}. Expires {relativeDay(i.expiresAt, now)}, {fmtDate(i.expiresAt)}.
                      </p>
                    </div>
                    <ActionButton action={revokeInvite} fields={{ inviteId: i.id }} className="btn btn-s btn-quiet btn-danger" label={`Cancel the invite for ${i.label}`} confirm={`Cancel the invite for ${i.label}? The link stops working.`}>
                      Cancel invite
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
            {closed.length ? (
              <details className={styles.closed}>
                <summary>Used, cancelled and expired ({closed.length})</summary>
                <ul className={`ruled ${styles.invites}`}>
                  {closed.map(({ i, usedByName }) => (
                    <li key={i.id}>
                      <div>
                        <b>{i.label}</b> <span className="muted">as {ROLE_LABEL[i.role].toLowerCase()}</span>
                        <p className="muted">
                          {i.usedAt
                            ? `Used by ${usedByName ?? "someone"} on ${fmtDateYear(i.usedAt)}.`
                            : i.revokedAt
                              ? `Cancelled ${fmtDateYear(i.revokedAt)}.`
                              : `Expired ${fmtDateYear(i.expiresAt)}.`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
