import type { Task } from "./tasks";

/** A group exists to dispatch together — with <2 members it's just a task again. */
export function normalizeGroups(tasks: Task[]): Task[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.groupId) counts.set(t.groupId, (counts.get(t.groupId) ?? 0) + 1);
  }
  return tasks.map((t) =>
    t.groupId && (counts.get(t.groupId) ?? 0) < 2
      ? { ...t, groupId: undefined }
      : t,
  );
}
