import { requireUserId } from "@/auth";
import { getPrDetails, listDeployments } from "@/app/lib/githubApp";
import { getTask } from "@/app/lib/tasks";
import { getGithubInstallationId } from "@/app/lib/userSettings";

/**
 * The task's PR — metadata plus per-file diffs — for the workspace review
 * screen. Read live from GitHub on every call; nothing is stored.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/tasks/[id]/pr">,
) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  const task = await getTask(userId, id);
  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }
  if (!task.prUrl) {
    return Response.json({ error: "task has no PR yet" }, { status: 400 });
  }
  const installationId = await getGithubInstallationId(userId);
  if (!installationId) {
    return Response.json(
      { error: "connect GitHub in Settings to review PRs here" },
      { status: 400 },
    );
  }

  try {
    const details = await getPrDetails(task.prUrl, installationId);
    if (!details) {
      return Response.json({ error: "PR not found on GitHub" }, { status: 404 });
    }
    // deployments are a bonus — a Deployments 403 must not blank out the diff
    const deployments = task.repoUrl
      ? await listDeployments(
          task.repoUrl,
          details.headSha, // a sha skips the branch-tip lookup inside
          installationId,
          3,
        ).catch(() => undefined)
      : undefined;
    return Response.json({ ...details, deployments });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
