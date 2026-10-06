import "server-only";
import { and, asc, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** Active teammates who can approve posts: for "ask for review" pickers. */
export async function approvers() {
  return db()
    .select({ id: schema.users.id, displayName: schema.users.displayName, username: schema.users.username, role: schema.users.role })
    .from(schema.users)
    .where(and(isNull(schema.users.disabledAt), inArray(schema.users.role, ["admin", "officer"])))
    .orderBy(asc(schema.users.displayName));
}

/** id -> display name, for showing authors and approvers. */
export async function namesById(): Promise<Map<string, string>> {
  const rows = await db().select({ id: schema.users.id, n: schema.users.displayName }).from(schema.users);
  return new Map(rows.map((r) => [r.id, r.n]));
}
