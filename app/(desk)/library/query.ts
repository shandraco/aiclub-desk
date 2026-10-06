import "server-only";
import { ilike, or, type SQL, type AnyColumn } from "drizzle-orm";

/** Case-insensitive "contains" over a few columns, with LIKE wildcards in the query escaped. */
export function contains(q: string, cols: AnyColumn[]): SQL | undefined {
  const t = q.trim().slice(0, 80);
  if (!t) return undefined;
  const pat = `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return or(...cols.map((c) => ilike(c, pat)));
}

export function listParams(sp: Record<string, string | string[] | undefined>) {
  const q = typeof sp.q === "string" ? sp.q : "";
  return { q, archived: sp.show === "archived" };
}
