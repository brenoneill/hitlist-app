// Migration: Add preview_url column to tasks table
// Usage: NODE_OPTIONS=--conditions=react-server npx tsx scripts/migrations/001-add-preview-url.mts
import { sql } from "../../app/lib/db";

console.log("Adding preview_url column to tasks...");
await sql`
  alter table tasks add column if not exists preview_url text
`;
console.log("✓ Migration complete");
