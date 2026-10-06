import type { Metadata } from "next";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getUser, hashToken } from "@/lib/auth/session";
import { ROLE_HELP, ROLE_LABEL } from "@/lib/auth/rules";
import { db, schema } from "@/lib/db";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = { title: "Join the desk" };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite] =
    token.length >= 20 && token.length <= 100
      ? await db()
          .select({ role: schema.invites.role, expiresAt: schema.invites.expiresAt })
          .from(schema.invites)
          .where(and(eq(schema.invites.tokenHash, hashToken(token)), isNull(schema.invites.usedAt), isNull(schema.invites.revokedAt), gt(schema.invites.expiresAt, new Date())))
          .limit(1)
      : [];

  if (!invite) {
    return (
      <>
        <h1>This invite doesn’t work</h1>
        <p className="muted">It has been used, has expired, or was cancelled. Invites last 7 days and work once. Ask an admin for a new link.</p>
      </>
    );
  }
  const me = await getUser();
  if (me) {
    return (
      <>
        <h1>You’re already signed in</h1>
        <p className="muted">You’re signed in as {me.displayName}. This invite is for someone new; sign out first if you meant to use it.</p>
      </>
    );
  }
  return (
    <>
      <div>
        <h1>Join the content desk</h1>
        <p className="muted" style={{ marginBlockStart: "var(--space-2xs)" }}>
          You’re joining as {ROLE_LABEL[invite.role].toLowerCase()}. {ROLE_HELP[invite.role]}
        </p>
      </div>
      <JoinForm token={token} />
    </>
  );
}
