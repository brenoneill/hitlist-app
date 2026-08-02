import { requireUserId } from "@/auth";
import { deleteImages } from "@/app/lib/catbox";
import {
  addTask,
  listTasks,
  reorderTasks,
  updateTask,
  type PrState,
  type Task,
} from "@/app/lib/tasks";
import type { LatestRun, RunStatus } from "@/app/lib/cursor";
import {
  getPreviewUrl,
  getPrState,
  getPrUrlForBranch,
} from "@/app/lib/githubApp";
import { PROVIDER_IDS, type ProviderId } from "@/app/lib/providerMeta";
import { PROVIDERS } from "@/app/lib/providers";
import {
  getGithubInstallationId,
  getProviderKey,
} from "@/app/lib/userSettings";

// A finished run does NOT auto-complete a task: it parks (rendered as "PR READY")
// so DONE only comes from a merge or the user marking it. Only failures auto-map.
const FAILED: Partial<Record<RunStatus, Task["status"]>> = {
  ERROR: "failed",
  CANCELLED: "failed",
  EXPIRED: "failed",
};

/** Run states past which nothing changes, so polling can stop. */
const TERMINAL_RUN: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "FINISHED",
  "ERROR",
  "CANCELLED",
  "EXPIRED",
]);

/**
 * Poll the agent run until it's terminal — and keep going after a successful
 * finish if we still have no prUrl (Copilot artifacts / GraphQL often lag or
 * 403 on Agent-tasks-only PATs; a later poll may resolve via branch REST).
 */
const needsRunPoll = (t: Task) => {
  if (!t.agentId) return false;
  const run = t.runStatus as RunStatus | undefined;
  if (!run || !TERMINAL_RUN.has(run)) return true;
  return (
    run === "FINISHED" &&
    !t.prUrl &&
    t.status !== "done" &&
    t.status !== "failed"
  );
};

/**
 * Provider reported a branch but not a PR url (common for Copilot). Keep asking
 * GitHub by head ref until a PR shows up — skip archived/failed hits.
 */
const needsPrDiscovery = (t: Task) =>
  !!t.agentId &&
  !!t.branch &&
  !!t.repoUrl &&
  !t.prUrl &&
  t.status !== "done" &&
  t.status !== "failed";

/** Poll a PR until it's merged or closed; unpolled (no prState) counts as open. */
const needsPrPoll = (t: Task) => !!t.prUrl && (t.prState ?? "open") === "open";

// ponytail: re-reads every poll rather than latching once — the provider mints a NEW
// preview url per commit, so a cached one points at stale code the moment the agent
// pushes again. Costs 2 GitHub calls per open-PR task; latch it if that ever bites.
/** Poll a branch's preview until its PR is merged or closed. */
const needsPreviewPoll = (t: Task) =>
  !!t.branch && !!t.repoUrl && (t.prState ?? "open") === "open";

/**
 * Brings dispatched tasks up to date with their agent run: status, branch,
 * PR url, final summary — then discovers a missing PR via the GitHub App from
 * the branch, then polls that PR's state. Only `running` tasks get their status
 * remapped — a manually toggled done/inbox task keeps its toggle, but still
 * captures the PR. Each half no-ops without its credential, so a caller
 * without keys just gets the stored tasks back.
 */
async function refresh(userId: string, tasks: Task[]): Promise<Task[]> {
  const keys = Object.fromEntries(
    await Promise.all(
      PROVIDER_IDS.map(async (p) => [p, await getProviderKey(userId, p)]),
    ),
  ) as Record<ProviderId, string | undefined>;
  const installationId = await getGithubInstallationId(userId);
  if (!Object.values(keys).some(Boolean) && !installationId) return tasks;

  // ponytail: serial + per-poll: up to 2 provider calls per running task and 1
  // GitHub call per open PR (one call covers open/closed/merged). Serial to
  // rate-limit the provider/GitHub, not the DB — updateTask is an atomic UPDATE now.
  // Move to a webhook if it ever gets chatty. A user PATCH landing mid-poll
  // can be overwritten by this stale snapshot (ms window, next poll self-heals);
  // if it ever annoys, CAS the status remap on `and status = 'running'`.
  const out: Task[] = [];
  // grouped tasks share an agentId / prUrl / branch — poll each once, not per member
  const runCache = new Map<string, LatestRun | undefined>();
  const prDiscoverCache = new Map<string, string | undefined>();
  const prCache = new Map<string, PrState>();
  const previewCache = new Map<string, string | undefined>();
  for (const task of tasks) {
    const patch: Partial<Task> = {};
    // pre-migration rows carry no provider; they were all dispatched to Cursor
    const provider = task.provider ?? "cursor";
    const apiKey = keys[provider];
    try {
      if (apiKey && needsRunPoll(task)) {
        const agentId = task.agentId!;
        const run = runCache.has(agentId)
          ? runCache.get(agentId)
          : await PROVIDERS[provider].getLatestRun(agentId, task.repoUrl, apiKey);
        runCache.set(agentId, run);
        if (run) {
          // ponytail: reuse "inbox" as the awaiting-merge rest state — statusDisplay
          // renders inbox+prUrl as "PR READY", so no new status is needed here.
          if (task.status === "running") {
            if (run.status === "FINISHED") patch.status = "inbox";
            else if (FAILED[run.status]) patch.status = FAILED[run.status];
          }
          if (run.status !== task.runStatus) patch.runStatus = run.status;
          if (run.branch && run.branch !== task.branch) patch.branch = run.branch;
          if (run.prUrl && run.prUrl !== task.prUrl) patch.prUrl = run.prUrl;
          if (run.summary && run.summary !== task.agentSummary) {
            patch.agentSummary = run.summary;
          }
        }
      }
      // Copilot (and flaky provider polls) often leave branch without prUrl —
      // resolve via the GitHub App, which already has Pull requests: Read.
      const afterRun = { ...task, ...patch };
      if (installationId && needsPrDiscovery(afterRun)) {
        const key = `${afterRun.repoUrl}#${afterRun.branch}`;
        const found = prDiscoverCache.has(key)
          ? prDiscoverCache.get(key)
          : await getPrUrlForBranch(
              afterRun.repoUrl!,
              afterRun.branch!,
              installationId,
            );
        prDiscoverCache.set(key, found);
        if (found) patch.prUrl = found;
      }
      // a real GitHub merge — not the manual toggle — is what archives to DONE
      const afterPr = { ...task, ...patch };
      if (installationId && needsPrPoll(afterPr)) {
        const prUrl = afterPr.prUrl!;
        const state = prCache.has(prUrl)
          ? prCache.get(prUrl)!
          : await getPrState(prUrl, installationId);
        prCache.set(prUrl, state);
        if (state !== task.prState) patch.prState = state;
        if (state === "merged") {
          patch.status = "done";
          patch.mergedAt = new Date().toISOString();
          await deleteImages(task.imageUrls);
          if (task.imageUrls?.length) patch.imageUrls = undefined;
        }
      }
      // last, and gated on the state just polled above: a 403 before the
      // Deployments scope is granted then loses only the preview url, not the
      // run/PR fields already collected — and a PR merged this pass stops here.
      if (installationId && needsPreviewPoll({ ...task, ...patch })) {
        const key = `${task.repoUrl}#${(patch.branch ?? task.branch)}`;
        const url = previewCache.has(key)
          ? previewCache.get(key)
          : await getPreviewUrl(
              task.repoUrl!,
              (patch.branch ?? task.branch)!,
              installationId,
            );
        previewCache.set(key, url);
        if (url !== task.previewUrl) patch.previewUrl = url;
      }
    } catch {
      // transient Cursor/GitHub error (incl. 403 before the PR-read or
      // Deployments scope is granted) — leave the task as-is; the next poll retries.
    }
    // only write when something changed — this runs every client poll
    out.push(
      Object.keys(patch).length
        ? ((await updateTask(userId, task.id, patch)) ?? task)
        : task,
    );
  }
  return out;
}

export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  return Response.json(await refresh(userId, await listTasks(userId)));
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const { title, repoUrl, details } = await request.json().catch(() => ({}));
  if (typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "title required" }, { status: 400 });
  }
  const repo =
    typeof repoUrl === "string" && repoUrl.trim() ? repoUrl.trim() : undefined;
  const detail =
    typeof details === "string" && details.trim() ? details : undefined;
  return Response.json(await addTask(userId, title.trim(), repo, detail), {
    status: 201,
  });
}

/** Persists a new order/grouping. Only id + groupId are accepted per entry. */
export async function PUT(request: Request) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const { order } = await request.json().catch(() => ({}));
  if (
    !Array.isArray(order) ||
    order.some(
      (e) =>
        typeof e?.id !== "string" ||
        (e.groupId !== null && typeof e.groupId !== "string"),
    )
  ) {
    return Response.json(
      { error: "order must be [{ id, groupId }]" },
      { status: 400 },
    );
  }
  return Response.json(
    await reorderTasks(
      userId,
      order.map((e: { id: string; groupId: string | null }) => ({
        id: e.id,
        groupId: e.groupId,
      })),
    ),
  );
}
