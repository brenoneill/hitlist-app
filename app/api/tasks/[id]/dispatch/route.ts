import { requireUserId } from "@/auth";
import { getTask, listTasks, updateTask, type Task } from "@/app/lib/tasks";
import { createAgent } from "@/app/lib/cursor";
import { getCursorApiKey } from "@/app/lib/userSettings";

/** repoUrl is a `https://github.com/{owner}/{repo}` URL. */
function screenshotCriteria(repoUrl: string): string {
  return `## Acceptance criteria (required)
- Run the app and capture screenshots proving each change works as described.
- Commit the screenshots to the branch (e.g. \`.pr-assets/\`) so they live with the PR.
- Embed them inline in the PR description using **publicly fetchable** image URLs (HTTP 200 with \`Content-Type: image/*\` and **no auth**). Private-repo GitHub raw links do **not** work in PR markdown — GitHub's image proxy fetches them unauthenticated and they 404 (this includes both \`raw.githubusercontent.com\` and \`${repoUrl}/raw/...\`).
- After uploading, verify each embed URL with an unauthenticated \`curl -sI\` (expect 200 + image content-type) before opening/updating the PR. Do not ship broken image placeholders.
- Preferred flow: commit files under \`.pr-assets/\`, upload the same files to a short-lived public host (e.g. litterbox.catbox.moe), embed with \`![desc](https://…)\`. Mention in the PR that originals are on the branch.
- If a screen is behind a login: check the Context section for test credentials or a dev auth-bypass; otherwise capture what you can (login page, unauthenticated states) and state plainly in the PR what could not be captured and why. Never fake or skip silently.`;
}

const WORKING_AGREEMENT = `## Working agreement
- Keep changes focused on this task; don't refactor unrelated code.
- Follow the repo's existing patterns and conventions.
- If anything is ambiguous, pick the simplest reasonable interpretation and note the assumption in the PR description.
- Open a PR with a clear summary of what changed and why.`;

/** Wraps task title(s) + optional details in the standard agent prompt. */
function buildPrompt(members: Task[], screenshots: boolean, repoUrl: string): string {
  const body =
    members.length === 1
      ? `# Task\n${members[0].title}` +
        (members[0].details ? `\n\n## Context\n${members[0].details}` : "")
      : `# Tasks\n` +
        members
          .map(
            (m) =>
              `- ${m.title}` +
              (m.details
                ? `\n  Context: ${m.details.replace(/\n/g, "\n  ")}`
                : ""),
          )
          .join("\n");
  return `${body}\n\n${screenshots ? `${screenshotCriteria(repoUrl)}\n\n` : ""}${WORKING_AGREEMENT}`;
}

/**
 * Dispatches an inbox task — or, if the task is grouped, its whole group — to
 * ONE Cursor cloud agent. The prompt is built by `buildPrompt` (title/bullet
 * list + optional per-task context + working agreement); a group's repo is the
 * first member's with one.
 * @param req - Optional JSON body with `ref` to override the starting branch and `model` to pick the agent's model.
 * @param ctx - Route context containing the task `id` param.
 * @returns The updated running task (or member array for a group), or an error response.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/tasks/[id]/dispatch">,
) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const cursorApiKey = await getCursorApiKey(userId);
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
  // cursorAgentId, not just status: a done→undone task is back in `inbox` but
  // already has an agent out there, and must not get a second one.
  if (members.some((t) => t.status !== "inbox" || t.cursorAgentId)) {
    return Response.json(
      {
        error: task.groupId
          ? "group has already-dispatched tasks"
          : task.cursorAgentId
            ? "task already has an agent"
            : `task already ${task.status}`,
      },
      { status: 409 },
    );
  }

  const repoUrl = members.find((m) => m.repoUrl)?.repoUrl;
  if (!repoUrl) {
    return Response.json(
      { error: "no repo tagged on this task or group" },
      { status: 400 },
    );
  }
  const { ref, model, screenshots } = (await req.json().catch(() => ({}))) as {
    ref?: string;
    model?: string;
    screenshots?: boolean;
  };

  try {
    const agent = await createAgent(
      buildPrompt(members, screenshots !== false, repoUrl), // on unless explicitly disabled
      repoUrl,
      ref,
      cursorApiKey,
      model,
    );
    // serial: the JSON store clobbers on parallel writes
    const updated: Task[] = [];
    for (const m of members) {
      const u = await updateTask(m.id, {
        status: "running",
        cursorAgentId: agent.id,
        agentUrl: agent.url,
        dispatchedAt: new Date().toISOString(),
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
