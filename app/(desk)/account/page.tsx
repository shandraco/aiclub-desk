import type { Metadata } from "next";
import { and, desc, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { ROLE_HELP, ROLE_LABEL } from "@/lib/auth/rules";
import { hashToken, requireUser, SESSION_COOKIE } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { ago, fmtDateYear } from "@/lib/time";
import { NameForm, PasswordForm, SignOutOthers } from "./AccountForms";
import styles from "./account.module.css";

export const metadata: Metadata = { title: "Your account" };

/** "Chrome on macOS" from a user-agent string; good enough to recognise your own devices. */
function device(ua: string | null): string {
  if (!ua) return "Unknown browser";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export default async function AccountPage() {
  const me = await requireUser();
  const here = hashToken((await cookies()).get(SESSION_COOKIE)?.value ?? "");
  const now = new Date();
  const sessions = await db()
    .select({ id: schema.sessions.id, ua: schema.sessions.userAgent, createdAt: schema.sessions.createdAt, lastUsedAt: schema.sessions.lastUsedAt })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, me.id), gt(schema.sessions.expiresAt, now)))
    .orderBy(desc(schema.sessions.lastUsedAt));
  const others = sessions.filter((s) => s.id !== here).length;
  // This browser first, then the most recent others; a long tail is summarised.
  const SHOW = 8;
  const ordered = [...sessions.filter((s) => s.id === here), ...sessions.filter((s) => s.id !== here)];
  const shown = ordered.slice(0, SHOW);
  const hidden = ordered.length - shown.length;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Your account</h1>
          <p>
            Signed in as @{me.username}, {ROLE_LABEL[me.role].toLowerCase()}. {ROLE_HELP[me.role]}
          </p>
        </div>
      </header>
      <div className={styles.grid}>
        <section className="panel" aria-labelledby="name-h">
          <h2 id="name-h">Name</h2>
          <NameForm name={me.displayName} />
        </section>
        <section className="panel" aria-labelledby="pw-h">
          <h2 id="pw-h">Password</h2>
          <PasswordForm username={me.username} />
        </section>
      </div>
      <section className="panel" aria-labelledby="sessions-h">
        <h2 id="sessions-h">
          Where you’re signed in <small>{sessions.length === 1 ? "1 session" : `${sessions.length} sessions`}</small>
        </h2>
        <ul className={`ruled ${styles.sessions}`}>
          {shown.map((s) => (
            <li key={s.id}>
              <div>
                <b>{device(s.ua)}</b>
                {s.id === here ? <span className={styles.here}> This browser</span> : null}
              </div>
              <p className="muted">
                Signed in {fmtDateYear(s.createdAt)}. Last active {ago(s.lastUsedAt, now)}.
              </p>
            </li>
          ))}
        </ul>
        {hidden > 0 ? <p className={styles.more}>And {hidden} older {hidden === 1 ? "session" : "sessions"}.</p> : null}
        <div className={styles.after}>
          <SignOutOthers others={others} />
          <p className="hint">
            {others === 0 ? "No other sessions. " : ""}If you used the desk on a shared or lost device, sign out the others and change your password.
          </p>
        </div>
      </section>
    </>
  );
}
