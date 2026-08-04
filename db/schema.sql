-- Apply once per Neon branch (SQL console or psql).
create table tasks (
  id text primary key,
  user_id text not null,
  position integer not null, -- array order; rewritten wholesale on reorder
  title text not null,
  status text not null default 'inbox'
    check (status in ('inbox', 'running', 'done', 'failed')),
  created_at timestamptz not null,
  provider text not null default 'cursor',
  agent_id text,
  agent_url text,
  repo_url text,
  run_status text,
  branch text,
  pr_url text,
  pr_state text,
  preview_url text,
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
  copilot_api_key text,
  github_installation_id text,
  -- Default visual confirmation for agent PRs: image-video | image | none.
  visual_confirmation text not null default 'image'
    check (visual_confirmation in ('image-video', 'image', 'none')),
  -- Preferred agent provider / model for deploys (null = auto / first configured).
  default_provider text
    check (default_provider is null or default_provider in ('cursor', 'copilot')),
  default_model text
);

create table task_messages (
  id text primary key,
  user_id text not null,
  -- Keyed by agent, not task: group members share one agent/conversation, and
  -- a redeploy (new agent_id) naturally starts a fresh thread.
  agent_id text not null,
  role text not null check (role in ('user', 'agent')),
  body text not null,
  -- Provider run id on agent replies — the sync dedupe key. Null (user
  -- messages) never conflicts under a plain unique.
  run_id text unique,
  created_at timestamptz not null default now()
);
create index task_messages_agent on task_messages (user_id, agent_id, created_at);

create table repo_settings (
  user_id text not null,
  repo_url text not null,
  -- Plain text by choice: instructions ("run npm run demo, log in as x") more
  -- than secrets, and users must be able to read back what they wrote.
  agent_access_notes text,
  primary key (user_id, repo_url)
);

-- Append-mostly run history for analytics (duration, success, model, follow-ups).
-- Tasks remain the UI source of truth for the latest run.
create table agent_runs (
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
);
create index agent_runs_user_started on agent_runs (user_id, started_at desc);
create index agent_runs_agent on agent_runs (agent_id, started_at desc);
