// Migration: user deploy defaults — visual_confirmation, default_provider,
// default_model. (visual_confirmation landed in schema.sql earlier without a
// migration, so prod may be missing it too.)
// Usage: NODE_OPTIONS=--conditions=react-server npx tsx scripts/migrations/003-add-deploy-defaults.mts
import { sql } from "../../app/lib/db";

console.log("Adding visual_confirmation column to user_settings...");
await sql`
  alter table user_settings
    add column if not exists visual_confirmation text not null default 'image'
`;
console.log("Adding default_provider column to user_settings...");
await sql`
  alter table user_settings
    add column if not exists default_provider text
`;
console.log("Adding default_model column to user_settings...");
await sql`
  alter table user_settings
    add column if not exists default_model text
`;
console.log("✓ Migration complete");
