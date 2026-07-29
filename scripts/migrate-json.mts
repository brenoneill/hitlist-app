// One-off import of .data/*.json into Postgres. Rerun-safe (on conflict do nothing).
// Usage: npx tsx --env-file=.env.local scripts/migrate-json.ts <userId>
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import type { Task } from "../app/lib/tasks";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
// ponytail: own neon client — app/lib/db.ts imports server-only, which throws under plain node
const sql = neon(url);

const userId = process.argv[2];
if (!userId) throw new Error("usage: migrate-json.ts <userId>");

const users: Record<
  string,
  { cursorApiKey?: string; githubInstallationId?: string }
> = JSON.parse(await readFile(".data/users.json", "utf8"));
if (!users[userId]) {
  throw new Error(
    `userId ${userId} not in users.json (${Object.keys(users).join(", ")})`,
  );
}

for (const [id, s] of Object.entries(users)) {
  await sql`
    insert into user_settings (user_id, cursor_api_key, github_installation_id)
    values (${id}, ${s.cursorApiKey ?? null}, ${s.githubInstallationId ?? null})
    on conflict (user_id) do update
      set cursor_api_key = excluded.cursor_api_key,
          github_installation_id = excluded.github_installation_id
  `;
}
console.log(`upserted ${Object.keys(users).length} user_settings rows`);

const tasks: Task[] = JSON.parse(await readFile(".data/tasks.json", "utf8"));
let inserted = 0;
for (const [i, t] of tasks.entries()) {
  const rows = await sql`
    insert into tasks (
      id, user_id, position, title, status, created_at,
      cursor_agent_id, agent_url, repo_url, run_status, branch, pr_url,
      pr_state, agent_summary, details, image_urls,
      dispatched_at, done_at, merged_at, group_id
    ) values (
      ${t.id}, ${userId}, ${i}, ${t.title}, ${t.status}, ${t.createdAt},
      ${t.cursorAgentId ?? null}, ${t.agentUrl ?? null}, ${t.repoUrl ?? null},
      ${t.runStatus ?? null}, ${t.branch ?? null}, ${t.prUrl ?? null},
      ${t.prState ?? null}, ${t.agentSummary ?? null}, ${t.details ?? null},
      ${t.imageUrls ?? null},
      ${t.dispatchedAt ?? null}, ${t.doneAt ?? null}, ${t.mergedAt ?? null},
      ${t.groupId ?? null}
    )
    on conflict (id) do nothing
    returning id
  `;
  inserted += rows.length;
}
console.log(`inserted ${inserted}/${tasks.length} tasks for ${userId}`);
