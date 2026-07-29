// Migration: multi-provider agents — tasks.provider, cursor_agent_id → agent_id,
// user_settings.copilot_api_key.
// Usage: NODE_OPTIONS=--conditions=react-server npx tsx scripts/migrations/002-add-provider.mts
import { sql } from "../../app/lib/db";

console.log("Adding provider column to tasks...");
await sql`
  alter table tasks add column if not exists provider text not null default 'cursor'
`;
console.log("Renaming cursor_agent_id to agent_id...");
await sql`
  do $$ begin
    if exists (select from information_schema.columns
               where table_name = 'tasks' and column_name = 'cursor_agent_id') then
      alter table tasks rename column cursor_agent_id to agent_id;
    end if;
  end $$
`;
console.log("Adding copilot_api_key column to user_settings...");
await sql`
  alter table user_settings add column if not exists copilot_api_key text
`;
console.log("✓ Migration complete");
