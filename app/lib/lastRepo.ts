import type { Task } from "@/app/lib/tasks";

/** localStorage key for the last repo tagged on Mark. */
export const LAST_REPO_KEY = "lastRepo";

/** Minimal repo shape needed to resolve a default (avoids importing UI types). */
export type RepoRef = { id: number; name: string; url: string };

/**
 * Remembers the last Mark repo so the composer can seed it next visit.
 *
 * @param url - GitHub repository URL to persist
 */
export function rememberLastRepo(url: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_REPO_KEY, url);
}

/**
 * Picks the Mark composer default repo: last-used URL if still pickable,
 * else the newest tagged mark's repo.
 *
 * @param pickable - Repos still available in the picker
 * @param tasks - Current marks (fallback when storage is empty)
 * @returns Matching repo, or null when none applies
 */
export function resolveDefaultRepo<T extends RepoRef>(
  pickable: T[],
  tasks: Task[],
): T | null {
  const fromStorage =
    typeof window === "undefined"
      ? null
      : localStorage.getItem(LAST_REPO_KEY);
  const fromTasks = [...tasks]
    .filter((t): t is Task & { repoUrl: string } => !!t.repoUrl)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.repoUrl;
  const lastUrl = fromStorage ?? fromTasks ?? null;
  if (!lastUrl) return null;
  return pickable.find((r) => r.url === lastUrl) ?? null;
}
