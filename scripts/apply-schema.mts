// Applies db/schema.sql to a fresh DATABASE_URL. Prefer `npm run db:migrate`
// (deploy + incremental). This script fails if tables already exist.
// Usage: npx tsx --env-file=.env.local scripts/apply-schema.mts
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
