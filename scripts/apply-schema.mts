// Applies db/schema.sql to whatever DATABASE_URL points at. Rerun-safe only in
// that it fails loudly on a table that already exists (Postgres has no
// "create table if not exists" complement, so plan for a fresh branch).
// Usage: npx tsx --env-file=.env.local scripts/apply-schema.ts
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);

const text = await readFile("db/schema.sql", "utf8");
const withoutComments = text
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const statements = withoutComments
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  await sql.query(stmt);
  console.log("ran:", stmt.split("\n")[0].slice(0, 60));
}
console.log(`applied ${statements.length} statements`);
