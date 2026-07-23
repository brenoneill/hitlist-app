import { auth } from "@/auth";
import {
  addTask,
  listTasks,
  reorderTasks,
  updateTask,
  type Task,
} from "@/app/lib/tasks";
import { getLatestRunStatus, type RunStatus } from "@/app/lib/cursor";
import { getCursorApiKey } from "@/app/lib/userSettings";

const TERMINAL: Partial<Record<RunStatus, Task["status"]>> = {
  FINISHED: "done",
  ERROR: "failed",
  CANCELLED: "failed",
  EXPIRED: "failed",
};

/**
 * Brings `running` tasks up to date with their Cursor run status.
 * No-op when signed out or without an API key — the stored tasks are returned as-is.
 */
async function refresh(tasks: Task[]): Promise<Task[]> {
  const session = await auth();
  const apiKey = session?.user && (await getCursorApiKey(session.user.id));
  if (!apiKey) return tasks;

  // ponytail: serial, 2 Cursor calls per running task per poll. Serial because
  // updateTask read-modify-writes one JSON file and parallel writes clobber.
  // Fine for a handful of tasks; move to a webhook if it ever gets chatty.
  const out: Task[] = [];
  // grouped tasks share a cursorAgentId — poll each agent once, not once per member
  const cache = new Map<string, RunStatus | undefined>();
  for (const task of tasks) {
    if (task.status !== "running" || !task.cursorAgentId) {
      out.push(task);
      continue;
    }
    try {
      const run = cache.has(task.cursorAgentId)
        ? cache.get(task.cursorAgentId)
        : await getLatestRunStatus(task.cursorAgentId, apiKey);
      cache.set(task.cursorAgentId, run);
      const next = run && TERMINAL[run];
      out.push(next ? ((await updateTask(task.id, { status: next })) ?? task) : task);
    } catch {
      // transient Cursor error — leave it running, next poll retries
      out.push(task);
    }
  }
  return out;
}

export async function GET() {
  return Response.json(await refresh(await listTasks()));
}

export async function POST(request: Request) {
  const { title, repoUrl } = await request.json().catch(() => ({}));
  if (typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "title required" }, { status: 400 });
  }
  if (typeof repoUrl !== "string" || !repoUrl.trim()) {
    return Response.json({ error: "repoUrl required" }, { status: 400 });
  }
  return Response.json(
    await addTask(title.trim(), repoUrl.trim()),
    { status: 201 },
  );
}

/** Persists a new order/grouping. Only id + groupId are accepted per entry. */
export async function PUT(request: Request) {
  const { order } = await request.json().catch(() => ({}));
  if (
    !Array.isArray(order) ||
    order.some(
      (e) =>
        typeof e?.id !== "string" ||
        (e.groupId !== null && typeof e.groupId !== "string"),
    )
  ) {
    return Response.json(
      { error: "order must be [{ id, groupId }]" },
      { status: 400 },
    );
  }
  return Response.json(
    await reorderTasks(
      order.map((e: { id: string; groupId: string | null }) => ({
        id: e.id,
        groupId: e.groupId,
      })),
    ),
  );
}
