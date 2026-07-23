import { auth } from "@/auth";
import { getTask, listTasks, updateTask, type Task } from "@/app/lib/tasks";
import { createAgent } from "@/app/lib/cursor";
import { getCursorApiKey } from "@/app/lib/userSettings";

/**
 * Dispatches an inbox task — or, if the task is grouped, its whole group — to
 * ONE Cursor cloud agent. A group's prompt is the member titles as a bullet
 * list; its repo is the first member's.
 * @param req - Optional JSON body with `ref` to override the starting branch.
 * @param ctx - Route context containing the task `id` param.
 * @returns The updated running task (or member array for a group), or an error response.
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
  const members = task.groupId
    ? (await listTasks()).filter((t) => t.groupId === task.groupId)
    : [task];
  if (members.some((t) => t.status !== "inbox")) {
    return Response.json(
      {
        error: task.groupId
          ? "group has non-inbox tasks"
          : `task already ${task.status}`,
      },
      { status: 409 },
    );
  }

  if (!members[0].repoUrl) {
    return Response.json({ error: "task has no repo" }, { status: 400 });
  }
  const { ref } = (await req.json().catch(() => ({}))) as { ref?: string };

  try {
    const agent = await createAgent(
      members.length === 1
        ? task.title
        : members.map((m) => `- ${m.title}`).join("\n"),
      members[0].repoUrl,
      ref || "main",
      cursorApiKey,
    );
    // serial: the JSON store clobbers on parallel writes
    const updated: Task[] = [];
    for (const m of members) {
      const u = await updateTask(m.id, {
        status: "running",
        cursorAgentId: agent.id,
        agentUrl: agent.url,
      });
      if (u) updated.push(u);
    }
    return Response.json(members.length === 1 ? updated[0] : updated);
  } catch (e) {
    // ponytail: keep the task in `inbox` on failure so a bad key / transient error can be retried.
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
