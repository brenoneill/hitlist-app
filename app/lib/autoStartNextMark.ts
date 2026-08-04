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

/** Next Mark or group to auto-deploy after merge. */
export type NextDeployTarget = {
  /** Id to POST /dispatch (any group member works — dispatch expands the group). */
  taskId: string;
  /** Checkbox subtitle / toast detail (titles joined for groups). */
  label: string;
  /** True when dispatching will start a whole group. */
  isGroup: boolean;
};

/**
 * First undeployed Mark or group for the same repo in list order.
 * Groups are suggested as a unit when every member is deployable.
 * Skips the merged task and its group members.
 *
 * @param tasks - Full task list in position order.
 * @param current - Task being merged.
 * @returns Next deploy target, or undefined when none.
 */
export function nextDeployTargetForRepo(
  tasks: Task[],
  current: Task,
): NextDeployTarget | undefined {
  if (!current.repoUrl) return undefined;
  const skip = new Set(
    current.groupId
      ? tasks.filter((t) => t.groupId === current.groupId).map((t) => t.id)
      : [current.id],
  );
  const seenGroups = new Set<string>();

  for (const t of tasks) {
    if (skip.has(t.id)) continue;

    if (t.groupId) {
      if (seenGroups.has(t.groupId)) continue;
      seenGroups.add(t.groupId);
      const members = tasks.filter((m) => m.groupId === t.groupId);
      const groupRepo = members.find((m) => m.repoUrl)?.repoUrl;
      if (groupRepo !== current.repoUrl) continue;
      if (members.some((m) => skip.has(m.id))) continue;
      if (!members.every(isDeployable)) continue;
      return {
        taskId: members[0].id,
        label: members.map((m) => m.title).join(" · "),
        isGroup: true,
      };
    }

    if (t.repoUrl !== current.repoUrl || !isDeployable(t)) continue;
    return { taskId: t.id, label: t.title, isGroup: false };
  }
  return undefined;
}
