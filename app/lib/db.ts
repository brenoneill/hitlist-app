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
    await db.exec(`
      insert into tasks (id, user_id, position, title, status, created_at, repo_url, provider, agent_id, agent_url, run_status, branch, pr_url, dispatched_at, done_at) values
        ('e2e-1', 'e2e-user', 0, 'Add dark mode toggle to settings', 'inbox', now(), 'https://github.com/example/hitlist-app', 'cursor', null, null, null, null, null, null, null),
        ('e2e-2', 'e2e-user', 1, 'Fix drag handle hit area on mobile', 'running', now(), 'https://github.com/example/hitlist-app', 'cursor', 'agent-demo', 'https://example.com/agent', 'RUNNING', null, null, now(), null),
        ('e2e-3', 'e2e-user', 2, 'Show PR preview links on task cards', 'done', now(), 'https://github.com/example/hitlist-app', 'copilot', 'agent-done', 'https://example.com/agent2', 'FINISHED', 'feat/preview-links', 'https://github.com/example/hitlist-app/pull/1', now(), now());
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
