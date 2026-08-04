// Migration: agent_runs — per-run analytics (duration, status, model, kind).
// Usage: NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local scripts/migrations/005-agent-runs.mts
import { sql } from "../../app/lib/db";

console.log("Creating agent_runs table...");
await sql`
  create table if not exists agent_runs (
    id text primary key,
    user_id text not null,
    task_id text,
    agent_id text not null,
    provider text not null,
    provider_run_id text,
    model text,
    kind text not null
      check (kind in ('dispatch', 'followup', 'redeploy')),
    status text,
    started_at timestamptz not null,
    finished_at timestamptz,
    created_at timestamptz not null default now(),
    unique (provider, provider_run_id)
  )
`;
console.log("Creating agent_runs indexes...");
await sql`
  create index if not exists agent_runs_user_started
    on agent_runs (user_id, started_at desc)
`;
await sql`
  create index if not exists agent_runs_agent
    on agent_runs (agent_id, started_at desc)
`;
console.log("✓ Migration complete");
