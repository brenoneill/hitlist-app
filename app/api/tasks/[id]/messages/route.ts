import { requireUserId } from "@/auth";
import { startRun } from "@/app/lib/agentRuns";
import { TERMINAL_RUN, type RunStatus } from "@/app/lib/cursor";
import { addMessage, listMessages } from "@/app/lib/messages";
import { PROVIDERS, type ProviderClient } from "@/app/lib/providers";
import { getTask, listTasks, updateTask, type Task } from "@/app/lib/tasks";
import { getProviderKey } from "@/app/lib/userSettings";

/**
 * The task's agent conversation. User turns are stored when we send them
 * (dispatch / follow-up); agent turns are synced here from the provider's
 * finished runs — sync-then-list, so a poll the app missed (or a task
 * dispatched before this feature existed) backfills on read.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/tasks/[id]/messages">,
) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  const task = await getTask(userId, id);
  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }
  if (!task.agentId) return Response.json([]);

  const provider = task.provider ?? "cursor";
  const client: ProviderClient = PROVIDERS[provider];
  if (client.listRuns && client.getRunResult) {
    const apiKey = await getProviderKey(userId, provider);
    if (apiKey) {
      try {
        const known = new Set(
          (await listMessages(userId, task.agentId))
            .map((m) => m.runId)
            .filter(Boolean),
        );
        for (const run of await client.listRuns(task.agentId, apiKey)) {
          if (run.status !== "FINISHED" || known.has(run.id)) continue;
          const result = await client.getRunResult(task.agentId, run.id, apiKey);
          if (result) {
            await addMessage(userId, task.agentId, "agent", result, {
              runId: run.id,
              createdAt: run.createdAt,
            });
          }
        }
      } catch {
        // transient provider error — serve what's stored; the next read retries
      }
    }
  }
  return Response.json(await listMessages(userId, task.agentId));
}

/**
 * Sends a follow-up prompt to the task's agent — a new run in the same
 * conversation, pushing to the same branch/PR. Members of a group re-enter
 * `running` so the existing task poll tracks the new run.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/tasks/[id]/messages">,
) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  const task = await getTask(userId, id);
  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }
  if (!task.agentId) {
    return Response.json({ error: "task has no agent yet" }, { status: 400 });
  }
  const provider = task.provider ?? "cursor";
  const client: ProviderClient = PROVIDERS[provider];
  if (!client.sendFollowup) {
    return Response.json(
      { error: "follow-ups aren't supported for this provider" },
      { status: 501 },
    );
  }
  const run = task.runStatus as RunStatus | undefined;
  if (task.status === "running" || (run && !TERMINAL_RUN.has(run))) {
    return Response.json({ error: "agent is still working" }, { status: 409 });
  }
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "text required" }, { status: 400 });
  }
  const apiKey = await getProviderKey(userId, provider);
  if (!apiKey) {
    return Response.json(
      { error: `add your ${provider} API key in Settings first` },
      { status: 400 },
    );
  }

  try {
    // send first — a failed send stores nothing, so it can simply be retried
    await client.sendFollowup(task.agentId, text.trim(), apiKey);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
  await addMessage(userId, task.agentId, "user", text.trim());
  await startRun({
    userId,
    taskId: id,
    agentId: task.agentId,
    provider,
    kind: "followup",
  }).catch(() => {});

  // resetting runStatus re-arms the run poll; branch/prUrl/prState stay — the
  // follow-up pushes to the same PR
  const members = task.groupId
    ? (await listTasks(userId)).filter((t) => t.groupId === task.groupId)
    : [task];
  const updated: Task[] = [];
  for (const m of members) {
    const u = await updateTask(userId, m.id, {
      status: "running",
      runStatus: "RUNNING",
      dispatchedAt: new Date().toISOString(),
    });
    if (u) updated.push(u);
  }
  return Response.json({ tasks: updated });
}
