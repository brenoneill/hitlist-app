import { requireUserId } from "@/auth";
import { deleteImages } from "@/app/lib/catbox";
import { mergePr } from "@/app/lib/githubApp";
import { getTask, listTasks, updateTask, type Task } from "@/app/lib/tasks";
import { getGithubInstallationId } from "@/app/lib/userSettings";

/**
 * Squash-merges the task's PR (needs the GitHub App's Pull requests + Contents
 * write permissions — pre-approval installs get GitHub's 403 message back).
 * On success every group member is archived exactly as the poll would on an
 * observed merge, so the UI flips instantly and the next poll agrees.
 */
export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/tasks/[id]/pr/merge">,
) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  const task = await getTask(userId, id);
  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }
  if (!task.prUrl) {
    return Response.json({ error: "task has no PR to merge" }, { status: 400 });
  }
  const installationId = await getGithubInstallationId(userId);
  if (!installationId) {
    return Response.json(
      { error: "connect GitHub in Settings to merge from here" },
      { status: 400 },
    );
  }

  try {
    await mergePr(task.prUrl, installationId);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  // group members share the PR — archive them all, mirroring refresh()'s merge patch
  const members = task.groupId
    ? (await listTasks(userId)).filter((t) => t.groupId === task.groupId)
    : [task];
  const updated: Task[] = [];
  for (const m of members) {
    await deleteImages(m.imageUrls);
    const u = await updateTask(userId, m.id, {
      prState: "merged",
      status: "done",
      mergedAt: new Date().toISOString(),
      ...(m.imageUrls?.length ? { imageUrls: undefined } : {}),
    });
    if (u) updated.push(u);
  }
  return Response.json(members.length === 1 ? updated[0] : updated);
}
