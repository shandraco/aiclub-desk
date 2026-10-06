/**
 * Integration tests use their own database (aiclub_desk_test by default), migrated fresh,
 * never the development or production one.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { vi } from "vitest";

const url = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/aiclub_desk_test";
if (/neon\.tech/.test(url)) throw new Error("Refusing to run tests against a Neon database.");
process.env.DATABASE_URL = url;

// Server actions read cookies/headers; tests call the library layer directly, so stub them.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));

// Top level, not beforeAll: describe() bodies run during collection, before hooks.
const pool = new Pool({ connectionString: url, max: 1 });
await pool.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
await pool.end();
