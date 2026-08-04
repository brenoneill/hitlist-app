import type { Task } from "@/app/lib/tasks";

/**
 * localStorage key prefix — append repo URL for per-repo auto-start-next
 * preference after merge. Same shape as COPILOT_ALLOWLIST_TIP_PREFIX.
 */
export const AUTO_START_NEXT_MARK_PREFIX = "autoStartNextMark:";

/**
 * Builds the localStorage key for one repo's auto-start-next preference.
 * @param repoUrl - GitHub repository URL on the merged task.
 */
export function autoStartNextMarkKey(repoUrl: string): string {
  return `${AUTO_START_NEXT_MARK_PREFIX}${repoUrl}`;
}

/**
 * Reads whether merge should auto-dispatch the next Mark for this repo.
 * @param repoUrl - GitHub repository URL on the merged task.
 * @returns true when the preference is stored as `"1"`.
 */
export function readAutoStartNextMark(repoUrl: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(autoStartNextMarkKey(repoUrl)) === "1";
}

/**
 * Persists the auto-start-next preference for one repo.
 * @param repoUrl - GitHub repository URL on the merged task.
 * @param on - When true, store `"1"`; when false, clear the key.
 */
export function writeAutoStartNextMark(repoUrl: string, on: boolean): void {
  const key = autoStartNextMarkKey(repoUrl);
  if (on) localStorage.setItem(key, "1");
  else localStorage.removeItem(key);
}

/** Undeployed inbox Mark — mirrors `deployable` without importing UI modules. */
function isDeployable(t: Task): boolean {
  return t.status === "inbox" && !t.agentUrl;
}

/**
 * First undeployed Mark for the same repo in list order.
 * Skips the merged task and its group members. Returns undefined when none.
 *
 * @param tasks - Full task list in position order.
 * @param current - Task being merged.
 * @returns Next deployable task, or undefined.
 */
export function nextMarkForRepo(
  tasks: Task[],
  current: Task,
): Task | undefined {
  if (!current.repoUrl) return undefined;
  const skip = new Set(
    current.groupId
      ? tasks.filter((t) => t.groupId === current.groupId).map((t) => t.id)
      : [current.id],
  );
  return tasks.find(
    (t) =>
      !skip.has(t.id) &&
      t.repoUrl === current.repoUrl &&
      isDeployable(t),
  );
}
