import { getTask, updateTask } from "@/app/lib/tasks";
import { createAgent } from "@/app/lib/cursor";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/tasks/[id]/dispatch">,
) {
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

  const repoUrl = process.env.CURSOR_REPO_URL;
  if (!repoUrl) {
    return Response.json({ error: "CURSOR_REPO_URL not set" }, { status: 500 });
  }
  const ref = process.env.CURSOR_REF || "main";

  try {
    const agent = await createAgent(task.title, repoUrl, ref);
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
