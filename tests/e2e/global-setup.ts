import { hash } from "@node-rs/argon2";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/**
 * Fresh e2e database: dropped, migrated, two accounts. Runs before `next start` serves tests.
 * Refuses anything that isn't a local database.
 */
export const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgres://localhost:5432/aiclub_desk_e2e";
export const PASSWORD = "e2e correct horse battery";

export default async function globalSetup() {
  if (!/@?localhost[:/]|127\.0\.0\.1/.test(E2E_DB)) throw new Error("e2e must run against a local database");
  const admin = new pg.Pool({ connectionString: E2E_DB.replace(/\/[^/]+$/, "/postgres"), max: 1 });
  const name = new URL(E2E_DB).pathname.slice(1);
  const exists = await admin.query("select 1 from pg_database where datname = $1", [name]);
  if (!exists.rowCount) await admin.query(`create database "${name}"`);
  await admin.end();

  const pool = new pg.Pool({ connectionString: E2E_DB, max: 1 });
  await pool.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  const h = await hash(PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await pool.query(
    `insert into users (username, display_name, password_hash, role) values
     ('ada', 'Ada Admin', $1, 'admin'), ('ben', 'Ben Officer', $1, 'officer'), ('locky', 'Lock Test', $1, 'member')`,
    [h],
  );
  await pool.end();
}
