import { auth } from "@/auth";
import { getTask, updateTask } from "@/app/lib/tasks";
import { createAgent } from "@/app/lib/cursor";
import { getCursorApiKey } from "@/app/lib/userSettings";

/**
 * Dispatches an inbox task to a Cursor cloud agent.
 * @param req - Optional JSON body with `repoUrl` to override the default repository.
 * @param ctx - Route context containing the task `id` param.
 * @returns The updated running task, or an error response.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/tasks/[id]/dispatch">,
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "sign in required" }, { status: 401 });
  }
  const cursorApiKey = await getCursorApiKey(session.user.id);
  if (!cursorApiKey) {
    return Response.json(
      { error: "add your Cursor API key in Settings first" },
      { status: 400 },
    );
  }

  const { id } = await ctx.params;
  const task = await getTask(id);
  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }
  if (task.status !== "inbox") {
    return Response.json(
      { error: `task already ${task.status}` },
      { status: 409 },
    );
  }

  if (!task.repoUrl) {
    return Response.json({ error: "task has no repo" }, { status: 400 });
  }
  const { ref } = (await req.json().catch(() => ({}))) as { ref?: string };

  const prompt = task.note?.trim()
    ? `${task.title}\n\n## Extra context\n${task.note.trim()}`
    : task.title;

  try {
    const agent = await createAgent(
      prompt,
      task.repoUrl,
      ref || "main",
      cursorApiKey,
    );
    const updated = await updateTask(id, {
      status: "running",
      cursorAgentId: agent.id,
      agentUrl: agent.url,
    });
    return Response.json(updated);
  } catch (e) {
    // ponytail: keep the task in `inbox` on failure so a bad key / transient error can be retried.
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
