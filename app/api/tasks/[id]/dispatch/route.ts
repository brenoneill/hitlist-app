import { requireUserId } from "@/auth";
import { getTask, listTasks, updateTask, type Task } from "@/app/lib/tasks";
import { PROVIDER_IDS, type ProviderId } from "@/app/lib/providerMeta";
import { PROVIDERS } from "@/app/lib/providers";
import {
  getAgentAccessNotes,
  getDeployDefaults,
  getProviderKey,
} from "@/app/lib/userSettings";
import {
  optionsForMode,
  resolveVisualConfirmation,
  type VisualConfirmationId,
} from "@/app/lib/prOptions";
import { playbookBootstrap } from "@/app/lib/hitlistPlaybook";

/**
 * Thin kickoff: HITLIST_RUN + playbook URL + task body.
 * Stable rules live in public/playbook/ (base + selected skill), served
 * composed at /playbook/[provider]/[mode] for the agent to fetch.
 * @param origin - HitList app origin for playbook part URLs.
 * @param members - Tasks included in this dispatch (one or a group).
 * @param provider - Agent provider; selects which visual skill to include.
 * @param mode - Visual confirmation mode; selects which visual skill to include.
 * @param accessNotes - Optional per-repo notes from user settings.
 */
function buildPrompt(
  origin: string,
  members: Task[],
  provider: ProviderId,
  mode: VisualConfirmationId,
  accessNotes?: string,
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
    ? `## Screenshots (user-attached)\nFetch and view these before starting. If one already 404s, say so in the PR rather than guessing its contents.\n${images.join("\n")}\n\n`
    : "";
  const notesSection = accessNotes
    ? `## Repo access notes (from the user)\nHow to run this app and get past login for testing/screenshots:\n${accessNotes}\n\n`
    : "";
  return `${playbookBootstrap(origin, provider, mode)}\n\n${body}\n\n${imageSection}${notesSection}`.trimEnd();
}

/**
 * Dispatches an inbox task — or, if the task is grouped, its whole group — to
 * ONE cloud agent. The prompt is built by `buildPrompt` (HITLIST_RUN playbook
 * bootstrap + title/bullet list + optional per-task context); a group's repo is
 * the first member's with one. Pass `redeploy: true` to replace an existing
 * agent with a fresh run (clears prior run/PR fields).
 * @param req - Optional JSON body with `provider` to pick the agent provider (default: Settings default, else first configured), `ref` to override the starting branch, `model` to pick the agent's model (absent ⇒ Settings default), `options` (visual confirmation ids: `image-video` | `image`, or `[]` for none; absent ⇒ user Settings default), and `redeploy` to start a new agent on an already-dispatched task.
 * @param ctx - Route context containing the task `id` param.
 * @returns The updated running task (or member array for a group), or an error response.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/tasks/[id]/dispatch">,
) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  const task = await getTask(userId, id);
  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }
  const members = task.groupId
    ? (await listTasks(userId)).filter((t) => t.groupId === task.groupId)
    : [task];
  const { provider: requested, ref, model, options, redeploy } = (await req
    .json()
    .catch(() => ({}))) as {
    provider?: ProviderId;
    ref?: string;
    model?: string;
    options?: string[];
    redeploy?: boolean;
  };

  if (redeploy) {
    // every member must already have been dispatched — redeploy replaces that agent
    if (members.some((t) => !t.agentId)) {
      return Response.json(
        {
          error: task.groupId
            ? "group has tasks that were never deployed"
            : "task has no agent to redeploy",
        },
        { status: 409 },
      );
    }
  } else if (members.some((t) => t.status !== "inbox" || t.agentId)) {
    // agentId, not just status: a done→undone task is back in `inbox` but
    // already has an agent out there, and must not get a second one.
    return Response.json(
      {
        error: task.groupId
          ? "group has already-dispatched tasks"
          : task.agentId
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

  const defaults = await getDeployDefaults(userId);

  // no provider in the body (quick deploy) ⇒ Settings default, else first key
  let provider = PROVIDER_IDS.find((p) => p === requested);
  let apiKey = provider ? await getProviderKey(userId, provider) : undefined;
  if (!apiKey && defaults.provider) {
    apiKey = await getProviderKey(userId, defaults.provider);
    if (apiKey) provider = defaults.provider;
  }
  if (!apiKey) {
    for (const p of PROVIDER_IDS) {
      apiKey = await getProviderKey(userId, p);
      if (apiKey) {
        provider = p;
        break;
      }
    }
  }
  if (!provider || !apiKey) {
    return Response.json(
      { error: "add a provider API key in Settings first" },
      { status: 400 },
    );
  }

  try {
    // absent body ⇒ user's Settings default; explicit [] means none required
    const resolvedOptions =
      options ?? optionsForMode(defaults.visualConfirmation);
    const mode = resolveVisualConfirmation(resolvedOptions);
    const resolvedModel = model ?? defaults.model ?? undefined;
    const origin = new URL(req.url).origin;
    const agent = await PROVIDERS[provider].createAgent(
      buildPrompt(
        origin,
        members,
        provider,
        mode,
        await getAgentAccessNotes(userId, repoUrl),
      ),
      repoUrl,
      ref,
      apiKey,
      resolvedModel,
    );
    const updated: Task[] = [];
    for (const m of members) {
      const u = await updateTask(userId, m.id, {
        status: "running",
        provider,
        agentId: agent.id,
        agentUrl: agent.url,
        dispatchedAt: new Date().toISOString(),
        // drop the previous run so the list/sheet track the new agent only
        ...(redeploy
          ? {
              runStatus: undefined,
              branch: undefined,
              prUrl: undefined,
              prState: undefined,
              previewUrl: undefined,
              agentSummary: undefined,
              doneAt: undefined,
              mergedAt: undefined,
            }
          : {}),
      });
      if (u) updated.push(u);
    }
    return Response.json(members.length === 1 ? updated[0] : updated);
  } catch (e) {
    // ponytail: keep the task unchanged on failure so a bad key / transient error can be retried.
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
