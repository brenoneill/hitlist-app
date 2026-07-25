import { normalizeGroups } from "./groups";
import { jsonFile } from "./jsonStore";

export type TaskStatus = "inbox" | "running" | "done" | "failed";

/** GitHub PR lifecycle; "merged"/"closed" are terminal and stop the PR poll. */
export type PrState = "open" | "closed" | "merged";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  cursorAgentId?: string;
  agentUrl?: string;
  repoUrl?: string;
  /** Raw Cursor run phase (CREATING/RUNNING/…), refreshed while running. */
  runStatus?: string;
  /** Branch / PR / final summary reported by the agent's latest run. */
  branch?: string;
  prUrl?: string;
  /** Polled from GitHub while the PR is open; absent means never polled (treat as open). */
  prState?: PrState;
  agentSummary?: string;
  /** Stamped when the agent is dispatched; drives "working for Xm". */
  dispatchedAt?: string;
  /** Optional extra context included in the agent prompt on dispatch. */
  details?: string;
  /** Stamped whenever status becomes "done"; orders the completed list. */
  doneAt?: string;
  /** Stamped when the PR is observed merged on GitHub; distinguishes MERGED from a manual EXECUTED. */
  mergedAt?: string;
  /** Tasks sharing a groupId form a contiguous run in the array and dispatch together. */
  groupId?: string;
}

const store = jsonFile<Task[]>("tasks.json", () => []);

export async function listTasks(): Promise<Task[]> {
  return store.read();
}

export async function addTask(title: string, repoUrl?: string): Promise<Task> {
  const tasks = await store.read();
  const task: Task = {
    id: crypto.randomUUID(),
    title,
    status: "inbox",
    createdAt: new Date().toISOString(),
    repoUrl,
  };
  tasks.unshift(task);
  await store.write(tasks);
  return task;
}

export async function removeTask(id: string): Promise<void> {
  const tasks = await store.read();
  await store.write(normalizeGroups(tasks.filter((t) => t.id !== id)));
}

/**
 * Rebuilds the list in the given order with the given group assignments.
 * Ids not in `order` are appended as-is (a concurrent add degrades gracefully);
 * unknown ids are ignored. Only ordering and groupId can change through this.
 */
export async function reorderTasks(
  order: { id: string; groupId: string | null }[],
): Promise<Task[]> {
  const tasks = await store.read();
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
  await store.write(normalized);
  return normalized;
}

export async function getTask(id: string): Promise<Task | undefined> {
  return (await store.read()).find((t) => t.id === id);
}

export async function updateTask(
  id: string,
  patch: Partial<Task>,
): Promise<Task | undefined> {
  const tasks = await store.read();
  const i = tasks.findIndex((t) => t.id === id);
  if (i === -1) return undefined;
  // stamped here, not at the callers — both the PATCH route and the Cursor poll land here
  tasks[i] = {
    ...tasks[i],
    ...patch,
    ...(patch.status === "done" ? { doneAt: new Date().toISOString() } : {}),
  };
  await store.write(tasks);
  return tasks[i];
}
