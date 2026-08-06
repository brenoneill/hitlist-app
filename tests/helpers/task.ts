import type { Task } from "@/app/lib/tasks";

/** Minimal Task for pure unit tests — only override what the case cares about. */
export function task(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    status: "inbox",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}
