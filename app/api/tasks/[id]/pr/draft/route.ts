import { requireUserId } from "@/auth";
import { markPrDraft } from "@/app/lib/githubApp";
import { getTask } from "@/app/lib/tasks";
import { getGithubInstallationId } from "@/app/lib/userSettings";

/**
 * Converts the task's ready PR back to draft so Merge is hidden again.
 * Needs the GitHub App's Pull requests write permission.
 * @returns `{ ok: true }` on success; error JSON otherwise.
 */
export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/tasks/[id]/pr/draft">,
) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  const task = await getTask(userId, id);
  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }
  if (!task.prUrl) {
    return Response.json({ error: "task has no PR to mark draft" }, { status: 400 });
  }
  const installationId = await getGithubInstallationId(userId);
  if (!installationId) {
    return Response.json(
      { error: "connect GitHub in Settings to mark PRs draft from here" },
      { status: 400 },
    );
  }

  try {
    await markPrDraft(task.prUrl, installationId);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
