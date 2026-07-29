import { requireUserId } from "@/auth";
import { getTask, listTasks, updateTask, type Task } from "@/app/lib/tasks";
import { createAgent } from "@/app/lib/cursor";
import { getCursorApiKey } from "@/app/lib/userSettings";
import { DEFAULT_PR_OPTIONS, optionSections } from "@/app/lib/prOptions";

const WORKING_AGREEMENT = `## Working agreement
- Keep changes focused on this task; don't refactor unrelated code.
- Follow the repo's existing patterns and conventions.
- If anything is ambiguous, pick the simplest reasonable interpretation and note the assumption in the PR description.
- Open a PR with a clear summary of what changed and why.`;

/** Wraps task title(s) + optional details in the standard agent prompt. */
function buildPrompt(
  members: Task[],
  options: readonly string[],
  repoUrl: string,
): string {
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
  // ponytail: URLs in prompt text, not Cursor's base64 `prompt.images` — the host is public; switch if agents stop fetching them.
  const images = members.flatMap((m) =>
    (m.imageUrls ?? []).map(
      (u) => `- ${members.length > 1 ? `${m.title}: ` : ""}${u}`,
    ),
  );
  const imageSection = images.length
    ? `## Screenshots (user-attached)\nFetch and view these before starting; they are on expiring temp hosting, so fetch them first. If one already 404s, say so in the PR rather than guessing its contents.\n${images.join("\n")}\n\n`
    : "";
  const sections = optionSections(options, repoUrl).map((s) => `${s}\n\n`);
  return `${body}\n\n${imageSection}${sections.join("")}${WORKING_AGREEMENT}`;
}

/**
 * Dispatches an inbox task — or, if the task is grouped, its whole group — to
 * ONE Cursor cloud agent. The prompt is built by `buildPrompt` (title/bullet
 * list + optional per-task context + working agreement); a group's repo is the
 * first member's with one.
 * @param req - Optional JSON body with `ref` to override the starting branch, `model` to pick the agent's model, and `options` (PR_OPTIONS ids) for the PR requirement sections.
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
  const task = await getTask(userId, id);
  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }
  const members = task.groupId
    ? (await listTasks(userId)).filter((t) => t.groupId === task.groupId)
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
  const { ref, model, options } = (await req.json().catch(() => ({}))) as {
    ref?: string;
    model?: string;
    options?: string[];
  };

  try {
    const agent = await createAgent(
      buildPrompt(members, options ?? DEFAULT_PR_OPTIONS, repoUrl), // absent body ⇒ defaults
      repoUrl,
      ref,
      cursorApiKey,
      model,
    );
    const updated: Task[] = [];
    for (const m of members) {
      const u = await updateTask(userId, m.id, {
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
