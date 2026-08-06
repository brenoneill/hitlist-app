import { sql } from "./db";
import { normalizeGroups } from "./groups";
import { newId } from "./id";
import type { ProviderId } from "./providerMeta";
import {
  isVisualConfirmationId,
  type VisualConfirmationId,
} from "./prOptions";

export type TaskStatus = "inbox" | "running" | "done" | "failed";

/** GitHub PR lifecycle; "merged"/"closed" are terminal and stop the PR poll. */
export type PrState = "open" | "closed" | "merged";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  /** Agent provider; column defaults to 'cursor', overwritten on dispatch. */
  provider?: ProviderId;
  /**
   * Model id used on the latest dispatch. `null` means provider Auto was used;
   * absent means this Mark has never been dispatched (or predates persistence).
   */
  model?: string | null;
  /** Visual confirmation mode used on the latest dispatch. */
  visualConfirmation?: VisualConfirmationId;
  agentId?: string;
  agentUrl?: string;
  repoUrl?: string;
  /** Run phase, normalized to Cursor's union (CREATING/RUNNING/…), refreshed while running. */
  runStatus?: string;
  /** Branch / PR / final summary reported by the agent's latest run. */
  branch?: string;
  prUrl?: string;
  /** Polled from GitHub while the PR is open; absent means never polled (treat as open). */
  prState?: PrState;
  /** Branch preview URL as reported to GitHub Deployments by Vercel/Netlify/etc; absent until the build goes green. */
  previewUrl?: string;
  agentSummary?: string;
  /** Stamped when the agent is dispatched; drives "working for Xm". */
  dispatchedAt?: string;
  /** Optional extra context included in the agent prompt on dispatch. */
  details?: string;
  /** User-attached screenshot URLs on files.catbox.moe (public; deleted on merge/remove). */
  imageUrls?: string[];
  /** Stamped whenever status becomes "done"; orders the completed list. */
  doneAt?: string;
  /** Stamped when the PR is observed merged on GitHub; distinguishes MERGED from a manual EXECUTED. */
  mergedAt?: string;
  /** Tasks sharing a groupId form a contiguous run in the array and dispatch together. */
  groupId?: string;
}

/** Patchable Task field → column. Order also drives updateTask's SET clause. */
const COLS = {
  title: "title",
  status: "status",
  provider: "provider",
  model: "model",
  visualConfirmation: "visual_confirmation",
  agentId: "agent_id",
  agentUrl: "agent_url",
  repoUrl: "repo_url",
  runStatus: "run_status",
  branch: "branch",
  prUrl: "pr_url",
  prState: "pr_state",
  previewUrl: "preview_url",
  agentSummary: "agent_summary",
  dispatchedAt: "dispatched_at",
  details: "details",
  imageUrls: "image_urls",
  doneAt: "done_at",
  mergedAt: "merged_at",
  groupId: "group_id",
} as const;

const iso = (v: unknown): string | undefined =>
  v == null ? undefined : (v as Date).toISOString();

/**
 * Ensures task dispatch-settings columns exist. Preview/prod Neon branches
 * often predate schema.sql; without this, reads/writes of model/visual 500.
 */
let taskDispatchSettingsReady: Promise<boolean> | undefined;
function ensureTaskDispatchSettingsColumns(): Promise<boolean> {
  return (taskDispatchSettingsReady ??= (async () => {
    try {
      await sql`
        alter table tasks
          add column if not exists model text
      `;
      await sql`
        alter table tasks
          add column if not exists visual_confirmation text
      `;
      return true;
    } catch {
      taskDispatchSettingsReady = undefined;
      return false;
    }
  })());
}

function rowToTask(r: Record<string, unknown>): Task {
  const visual =
    typeof r.visual_confirmation === "string" &&
    isVisualConfirmationId(r.visual_confirmation)
      ? r.visual_confirmation
      : undefined;
  return {
    id: r.id as string,
    title: r.title as string,
    status: r.status as TaskStatus,
    createdAt: iso(r.created_at)!,
    provider: (r.provider as ProviderId) ?? undefined,
    // distinguish never-set (absent key / pre-migration) from Auto (SQL null)
    ...("model" in r ? { model: (r.model as string | null) ?? null } : {}),
    visualConfirmation: visual,
    agentId: (r.agent_id as string) ?? undefined,
    agentUrl: (r.agent_url as string) ?? undefined,
    repoUrl: (r.repo_url as string) ?? undefined,
    runStatus: (r.run_status as string) ?? undefined,
    branch: (r.branch as string) ?? undefined,
    prUrl: (r.pr_url as string) ?? undefined,
    prState: (r.pr_state as PrState) ?? undefined,
    previewUrl: (r.preview_url as string) ?? undefined,
    agentSummary: (r.agent_summary as string) ?? undefined,
    dispatchedAt: iso(r.dispatched_at),
    details: (r.details as string) ?? undefined,
    imageUrls: (r.image_urls as string[]) ?? undefined,
    doneAt: iso(r.done_at),
    mergedAt: iso(r.merged_at),
    groupId: (r.group_id as string) ?? undefined,
  };
}

export async function listTasks(userId: string): Promise<Task[]> {
  await ensureTaskDispatchSettingsColumns();
  const rows = await sql`
    select * from tasks where user_id = ${userId} order by position, id
  `;
  return rows.map(rowToTask);
}

export async function addTask(
  userId: string,
  title: string,
  repoUrl?: string,
  details?: string,
): Promise<Task> {
  // unshift: land above the current minimum; gaps/negatives are fine, only
  // relative order matters
  const rows = await sql`
    insert into tasks (id, user_id, position, title, status, created_at, repo_url, details)
    values (
      ${newId()}, ${userId},
      coalesce((select min(position) from tasks where user_id = ${userId}), 0) - 1,
      ${title}, 'inbox', now(), ${repoUrl ?? null}, ${details ?? null}
    )
    returning *
  `;
  return rowToTask(rows[0]);
}

export async function removeTask(userId: string, id: string): Promise<void> {
  // second statement is normalizeGroups in SQL: a group left with <2 members dissolves
  await sql.transaction((txn) => [
    txn`delete from tasks where id = ${id} and user_id = ${userId}`,
    txn`
      update tasks set group_id = null
      where user_id = ${userId} and group_id in (
        select group_id from tasks
        where user_id = ${userId} and group_id is not null
        group by group_id having count(*) < 2
      )
    `,
  ]);
}

/**
 * Rebuilds the list in the given order with the given group assignments.
 * Ids not in `order` are appended as-is (a concurrent add degrades gracefully);
 * unknown ids are ignored. Only ordering and groupId can change through this.
 */
export async function reorderTasks(
  userId: string,
  order: { id: string; groupId: string | null }[],
): Promise<Task[]> {
  const tasks = await listTasks(userId);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const next: Task[] = [];
  for (const { id, groupId } of order) {
    const t = byId.get(id);
    if (!t) continue;
    byId.delete(id);
    next.push({ ...t, groupId: groupId ?? undefined });
  }
  next.push(...byId.values());
  const normalized = normalizeGroups(next);
  // one statement for the whole list; "" stands in for null in the text[] param
  await sql`
    update tasks t set position = v.pos, group_id = nullif(v.gid, '')
    from unnest(
      ${normalized.map((t) => t.id)}::text[],
      ${normalized.map((_, i) => i)}::int[],
      ${normalized.map((t) => t.groupId ?? "")}::text[]
    ) as v(id, pos, gid)
    where t.id = v.id and t.user_id = ${userId}
  `;
  return normalized;
}

export async function getTask(
  userId: string,
  id: string,
): Promise<Task | undefined> {
  await ensureTaskDispatchSettingsColumns();
  const rows = await sql`
    select * from tasks where id = ${id} and user_id = ${userId}
  `;
  return rows[0] ? rowToTask(rows[0]) : undefined;
}

export async function updateTask(
  userId: string,
  id: string,
  patch: Partial<Task>,
): Promise<Task | undefined> {
  await ensureTaskDispatchSettingsColumns();
  // a key present with value undefined clears the column (PATCH route relies
  // on this for details/repoUrl/imageUrls); an absent key leaves it alone
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(COLS)) {
    if (key in patch) {
      values.push(patch[key as keyof typeof COLS] ?? null);
      sets.push(`${col} = $${values.length}`);
    }
  }
  // stamped here, not at the callers — both the PATCH route and the Cursor poll land here
  if (patch.status === "done" && !("doneAt" in patch)) {
    values.push(new Date().toISOString());
    sets.push(`done_at = $${values.length}`);
  }
  if (!sets.length) return getTask(userId, id);
  values.push(id, userId);
  const rows = await sql.query(
    `update tasks set ${sets.join(", ")}
     where id = $${values.length - 1} and user_id = $${values.length}
     returning *`,
    values,
  );
  return rows[0] ? rowToTask(rows[0] as Record<string, unknown>) : undefined;
}
