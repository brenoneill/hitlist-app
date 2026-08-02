import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon-shaped facade over an in-memory PGlite for E2E/agent-sandbox runs
 * (AUTH_E2E=1), where no real database or secrets exist. Fresh schema + demo
 * seed on every boot, so screenshots are deterministic. Covers exactly the
 * neon surface the DAL uses: sql``, sql.query, sql.transaction.
 */
function e2eSql(): NeonQueryFunction<false, false> {
  const g = globalThis as { __e2eDb?: Promise<unknown> };
  const ready = (g.__e2eDb ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const { readFile } = await import("node:fs/promises");
    const db = new PGlite();
    await db.exec(await readFile("db/schema.sql", "utf8"));
    // "e2e-user" matches the id minted by the E2E credentials provider (auth.ts)
    // Multiple repos so the main-screen project filter has more than one hit.
    await db.exec(`
      insert into tasks (id, user_id, position, title, status, created_at, repo_url, provider, agent_id, agent_url, run_status, branch, pr_url, pr_state, agent_summary, dispatched_at, done_at, merged_at) values
        ('e2e-1', 'e2e-user', 0, 'Add dark mode toggle to settings', 'inbox', now(), 'https://github.com/example/hitlist-app', 'cursor', null, null, null, null, null, null, null, null, null, null),
        ('e2e-2', 'e2e-user', 1, 'Fix drag handle hit area on mobile', 'running', now(), 'https://github.com/example/mobile-shell', 'cursor', 'agent-demo', 'https://example.com/agent', 'RUNNING', null, null, null, null, now(), null, null),
        ('e2e-4', 'e2e-user', 2, 'Ship hotfix that landed outside the agent', 'failed', now(), 'https://github.com/example/hitlist-app', 'cursor', 'agent-botched', 'https://example.com/agent-botched', 'ERROR', null, null, null, 'Agent errored mid-run — finished by hand', now(), null, null),
        ('e2e-3', 'e2e-user', 3, 'Have the repos collapsed by default instead of folded up (in settings page)', 'done', now(), 'https://github.com/example/docs-site', 'copilot', 'agent-done', 'https://example.com/agent2', 'FINISHED', 'feat/preview-links', 'https://github.com/example/docs-site/pull/1', 'merged', 'Shipped in PR #1: https://github.com/example/docs-site/pull/1', now(), now(), now()),
        ('e2e-5', 'e2e-user', 4, 'Be able to drop the saved cursor key', 'done', now(), 'https://github.com/example/hitlist-app', 'cursor', 'agent-done-2', 'https://example.com/agent3', 'FINISHED', 'chore/drop-key', 'https://github.com/example/hitlist-app/pull/2', 'merged', 'Removed unused Cursor key storage from settings', now(), now(), now());
      insert into task_messages (id, user_id, agent_id, role, body, run_id, created_at) values
        ('e2e-m1', 'e2e-user', 'agent-done-2', 'user', E'# Task\nBe able to drop the saved cursor key', null, now() - interval '30 minutes'),
        ('e2e-m2', 'e2e-user', 'agent-done-2', 'agent', 'Removed unused Cursor key storage from settings — see PR #2.', 'run-demo-1', now() - interval '25 minutes'),
        ('e2e-m3', 'e2e-user', 'agent-done-2', 'user', 'Also clear the key from localStorage on sign-out.', null, now() - interval '20 minutes'),
        ('e2e-m4', 'e2e-user', 'agent-done-2', 'agent', 'Done — sign-out now wipes the cached key as well; pushed to the same PR.', 'run-demo-2', now() - interval '15 minutes'),
        ('e2e-m5', 'e2e-user', 'agent-demo', 'user', E'# Task\nFix drag handle hit area on mobile', null, now() - interval '2 minutes');
    `);
    return db;
  })());
  type Q = { text: string; params: unknown[] };
  const toQuery = (strings: TemplateStringsArray, params: unknown[]): Q => ({
    text: strings.reduce((q, s, i) => q + "$" + i + s),
    params,
  });
  const run = async ({ text, params }: Q) => {
    const db = (await ready) as import("@electric-sql/pglite").PGlite;
    return (await db.query(text, params)).rows;
  };
  const tag = (strings: TemplateStringsArray, ...params: unknown[]) =>
    run(toQuery(strings, params));
  tag.query = (text: string, params: unknown[]) => run({ text, params });
  tag.transaction = async (fn: (txn: unknown) => Q[]) => {
    const txn = (strings: TemplateStringsArray, ...params: unknown[]) =>
      toQuery(strings, params);
    const queries = fn(txn);
    const db = (await ready) as import("@electric-sql/pglite").PGlite;
    return db.transaction(async (tx) => {
      const results = [];
      for (const q of queries) results.push((await tx.query(q.text, q.params)).rows);
      return results;
    });
  };
  return tag as unknown as NeonQueryFunction<false, false>;
}

const url = process.env.DATABASE_URL;
/** Stateless HTTP driver: one fetch per query, parameterized by default. */
export const sql =
  process.env.AUTH_E2E === "1"
    ? e2eSql() // E2E always wins — never lets an agent run touch a real DB
    : neon(url ?? missing());

function missing(): never {
  throw new Error("DATABASE_URL is not set — add it to .env.local");
}
