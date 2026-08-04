// Clears every app table on DATABASE_URL. Dev-only — refuses without an
// explicit hostname confirm, and blocks known/obvious production hosts.
// Usage: npm run db:wipe -- --confirm=<hostname>
// Tip: set PROD_DATABASE_HOST in .env.local to permanently refuse that endpoint.
import { neon } from "@neondatabase/serverless";

const TABLES = ["task_messages", "tasks", "repo_settings", "user_settings"] as const;

function hostOf(databaseUrl: string): string {
  return new URL(databaseUrl).hostname;
}

function looksProd(host: string): boolean {
  return /(^|[.-])(prod|production)([.-]|$)/i.test(host);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set — pass via --env-file=.env.local");

const host = hostOf(url);
const confirm = process.argv
  .find((a) => a.startsWith("--confirm="))
  ?.slice("--confirm=".length);

if (process.env.VERCEL_ENV === "production") {
  throw new Error("refusing to wipe: VERCEL_ENV is production");
}

const prodHost = process.env.PROD_DATABASE_HOST;
if (prodHost && host === prodHost) {
  throw new Error(`refusing to wipe: ${host} is PROD_DATABASE_HOST`);
}

if (looksProd(host)) {
  throw new Error(`refusing to wipe: hostname looks like production (${host})`);
}

if (!confirm) {
  throw new Error(
    `refusing to wipe without --confirm=${host}\n` +
      `(set PROD_DATABASE_HOST in .env.local to permanently block your prod endpoint)`,
  );
}

if (confirm !== host) {
  throw new Error(`--confirm=${confirm} does not match DATABASE_URL host ${host}`);
}

const sql = neon(url);
const [before] = await sql.query(
  `select
     (select count(*)::int from tasks) as tasks,
     (select count(*)::int from task_messages) as task_messages,
     (select count(*)::int from user_settings) as user_settings,
     (select count(*)::int from repo_settings) as repo_settings`,
);
console.log("wiping", host, before);
await sql.query(`truncate ${TABLES.join(", ")}`);
console.log("wiped");
