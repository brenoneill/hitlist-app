// Migration: task_messages — in-app agent conversation (user prompts stored on
// dispatch/follow-up, agent replies synced from provider run results).
// Usage: NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local scripts/migrations/004-task-messages.mts
import { sql } from "../../app/lib/db";

console.log("Creating task_messages table...");
await sql`
  create table if not exists task_messages (
    id text primary key,
    user_id text not null,
    agent_id text not null,
    role text not null check (role in ('user', 'agent')),
    body text not null,
    run_id text unique,
    created_at timestamptz not null default now()
  )
`;
console.log("Creating task_messages index...");
await sql`
  create index if not exists task_messages_agent
    on task_messages (user_id, agent_id, created_at)
`;
console.log("✓ Migration complete");
