// Idempotent migrate for deploy + local. Fresh DB → db/schema.sql; existing → pending ALTERs.
// Usage: npm run db:migrate
// Vercel: runs from `npm run build` when DATABASE_URL is set in the environment.
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);

type Migration = { id: string; statements: string[] };

// Net of scripts/migrations/*.mts — keep in sync when adding schema changes.
const MIGRATIONS: Migration[] = [
  {
    id: "001-add-preview-url",
    statements: [`alter table tasks add column if not exists preview_url text`],
  },
  {
    id: "002-add-provider",
    statements: [
      `alter table tasks add column if not exists provider text not null default 'cursor'`,
      `do $$ begin
        if exists (select from information_schema.columns
                   where table_name = 'tasks' and column_name = 'cursor_agent_id') then
          alter table tasks rename column cursor_agent_id to agent_id;
        end if;
      end $$`,
      `alter table user_settings add column if not exists copilot_api_key text`,
    ],
  },
  {
    id: "003-add-deploy-defaults",
    statements: [
      `alter table user_settings add column if not exists visual_confirmation text not null default 'image'`,
      `alter table user_settings add column if not exists default_provider text`,
      `alter table user_settings add column if not exists default_model text`,
    ],
  },
  {
    id: "004-task-messages",
    statements: [
      `create table if not exists task_messages (
        id text primary key,
        user_id text not null,
        agent_id text not null,
        role text not null check (role in ('user', 'agent')),
        body text not null,
        run_id text unique,
        created_at timestamptz not null default now()
      )`,
      `create index if not exists task_messages_agent
        on task_messages (user_id, agent_id, created_at)`,
    ],
  },
  {
    id: "005-agent-runs",
    statements: [
      `create table if not exists agent_runs (
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
      )`,
      `create index if not exists agent_runs_user_started
        on agent_runs (user_id, started_at desc)`,
      `create index if not exists agent_runs_agent
        on agent_runs (agent_id, started_at desc)`,
    ],
  },
  {
    id: "006-task-dispatch-settings",
    statements: [
      `alter table tasks add column if not exists model text`,
      `alter table tasks add column if not exists visual_confirmation text`,
    ],
  },
];

async function runStatements(statements: string[]) {
  for (const stmt of statements) {
    await sql.query(stmt);
  }
}

async function applySchemaSql() {
  const text = await readFile("db/schema.sql", "utf8");
  const withoutComments = text
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  const statements = withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await runStatements(statements);
  console.log(`applied schema.sql (${statements.length} statements)`);
}

await sql.query(`
  create table if not exists schema_migrations (
    id text primary key,
    applied_at timestamptz not null default now()
  )
`);

const hasTasks = await sql.query(`
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'tasks'
`);

if (hasTasks.length === 0) {
  await applySchemaSql();
  for (const m of MIGRATIONS) {
    await sql.query(`insert into schema_migrations (id) values ($1) on conflict do nothing`, [
      m.id,
    ]);
  }
  console.log(`stamped ${MIGRATIONS.length} migrations (fresh schema)`);
  process.exit(0);
}

const rows = (await sql.query(`select id from schema_migrations`)) as { id: string }[];
const applied = new Set(rows.map((r) => r.id));

let n = 0;
for (const m of MIGRATIONS) {
  if (applied.has(m.id)) continue;
  await runStatements(m.statements);
  await sql.query(`insert into schema_migrations (id) values ($1)`, [m.id]);
  console.log("applied", m.id);
  n++;
}
console.log(n === 0 ? "migrations up to date" : `applied ${n} migration(s)`);
