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
    check (visual_confirmation in ('image-video', 'image', 'none'))
);

create table repo_settings (
  user_id text not null,
  repo_url text not null,
  -- Plain text by choice: instructions ("run npm run demo, log in as x") more
  -- than secrets, and users must be able to read back what they wrote.
  agent_access_notes text,
  primary key (user_id, repo_url)
);
