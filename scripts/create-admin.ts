/**
 * Creates the first admin account, or resets an admin's password. Run once after the first
 * deploy, with DATABASE_URL pointing at the production database:
 *
 *   pnpm admin:create <username> "<Display name>"
 *
 * The password is read from the terminal without echo, never from an argument (shell history).
 */
import { hash } from "@node-rs/argon2";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { Pool } from "pg";
import { ARGON2_OPTIONS, passwordProblem, usernameProblem } from "../lib/auth/rules";

const [username, ...nameParts] = process.argv.slice(2);
const displayName = nameParts.join(" ").trim();
if (!username || !displayName) {
  console.error('Usage: pnpm admin:create <username> "<Display name>"');
  process.exit(1);
}
const u = username.toLowerCase();
const uProblem = usernameProblem(u);
if (uProblem) {
  console.error(uProblem);
  process.exit(1);
}

let muted = false;
const out = new Writable({ write(chunk, _enc, cb) { if (!muted) process.stdout.write(chunk); cb(); } });
const rl = createInterface({ input: process.stdin, output: out, terminal: true });
async function ask(q: string) {
  process.stdout.write(q);
  muted = true;
  const a = await rl.question("");
  muted = false;
  process.stdout.write("\n");
  return a;
}
const password = await ask("Password: ");
const again = await ask("Same password again: ");
rl.close();
if (password !== again) {
  console.error("The passwords differ.");
  process.exit(1);
}
const pProblem = passwordProblem(password, u);
if (pProblem) {
  console.error(pProblem);
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const passwordHash = await hash(password, ARGON2_OPTIONS);
const res = await pool.query(
  `insert into users (username, display_name, password_hash, role)
   values ($1, $2, $3, 'admin')
   on conflict (username) do update set password_hash = excluded.password_hash, role = 'admin', disabled_at = null
   returning id`,
  [u, displayName, passwordHash],
);
await pool.query("delete from sessions where user_id = $1", [res.rows[0].id]);
await pool.end();
console.log(`Admin "${u}" is ready. Sign in at /login.`);
