import "server-only";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";

/**
 * One Drizzle client. Neon hosts use Neon's WebSocket pool (transactions work, no TCP in
 * serverless); anything else (local Postgres in development and tests) uses node-postgres.
 * Created on first use so `next build` does not need a database.
 */
export type DB = NodePgDatabase<typeof schema>;

let client: DB | null = null;

export function db(): DB {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  const isNeon = new URL(url).hostname.endsWith(".neon.tech");
  client = isNeon
    ? (drizzleNeon(new NeonPool({ connectionString: url }), { schema }) as unknown as DB)
    : drizzlePg(new PgPool({ connectionString: url, max: 5 }), { schema });
  return client;
}

export { schema };
