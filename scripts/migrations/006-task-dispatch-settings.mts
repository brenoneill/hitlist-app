// Migration: persist last dispatch model + visual confirmation on tasks so
// auto-start-next can inherit settings from the merged Mark.
// Usage: NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local scripts/migrations/006-task-dispatch-settings.mts
import { sql } from "../../app/lib/db";

console.log("Adding model column to tasks...");
await sql`
  alter table tasks
    add column if not exists model text
`;
console.log("Adding visual_confirmation column to tasks...");
await sql`
  alter table tasks
    add column if not exists visual_confirmation text
`;
console.log("✓ Migration complete");
