-- Apply once per Neon branch (SQL console or psql).
create table tasks (
  id text primary key,
  user_id text not null,
  position integer not null, -- array order; rewritten wholesale on reorder
  title text not null,
  status text not null default 'inbox'
    check (status in ('inbox', 'running', 'done', 'failed')),
  created_at timestamptz not null,
  cursor_agent_id text,
  agent_url text,
  repo_url text,
  run_status text,
  branch text,
  pr_url text,
  pr_state text,
  agent_summary text,
  details text,
  image_urls text[],
  dispatched_at timestamptz,
  done_at timestamptz,
  merged_at timestamptz,
  group_id text
);
create index tasks_user_position on tasks (user_id, position);

create table user_settings (
  user_id text primary key,
  -- AES-256-GCM ciphertext (app/lib/crypto.ts), keyed by SETTINGS_ENCRYPTION_KEY.
  cursor_api_key text,
  github_installation_id text
);
