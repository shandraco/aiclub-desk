/**
 * Applies drizzle/*.sql in order and records them in drizzle.__drizzle_migrations.
 * Usage: pnpm db:migrate  (reads DATABASE_URL from the environment or .env.local)
 * Neon accepts plain TCP Postgres connections, so node-postgres works for both.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const pool = new Pool({ connectionString: url, max: 1 });
await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
await pool.end();
console.log("Migrations applied.");
