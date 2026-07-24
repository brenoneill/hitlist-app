import { auth } from "@/auth";
import {
  addTask,
  listTasks,
  reorderTasks,
  updateTask,
  type Task,
} from "@/app/lib/tasks";
import { getLatestRun, type LatestRun, type RunStatus } from "@/app/lib/cursor";
import { getPullMerged, parsePrUrl } from "@/app/lib/githubApp";
import {
  getCursorApiKey,
  getGithubInstallationId,
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

/** Poll the Cursor run until it's been seen terminal once; then it can't change. */
const needsRunPoll = (t: Task) =>
  !!t.cursorAgentId && !(t.runStatus && TERMINAL_RUN.has(t.runStatus as RunStatus));

/** Poll the open PR for a merge until it lands (or the task is failed/archived). */
const needsMergePoll = (t: Task) =>
  !!t.prUrl && !t.mergedAt && t.status !== "failed" && t.status !== "done";

/** Merge state of the task's PR; false (not merged) if the url is unparseable. */
async function checkMerged(
  prUrl: string,
  installationId: string,
): Promise<boolean> {
  const pr = parsePrUrl(prUrl);
  return pr ? getPullMerged(installationId, pr.owner, pr.repo, pr.number) : false;
}

/**
 * Brings dispatched tasks up to date with their Cursor run: status, branch,
 * PR url, final summary. Only `running` tasks get their status remapped — a
 * manually toggled done/inbox task keeps its toggle, but still captures the PR.
 * No-op when signed out or without an API key — the stored tasks are returned as-is.
 */
async function refresh(tasks: Task[]): Promise<Task[]> {
  const session = await auth();
  const userId = session?.user?.id;
  const apiKey = userId ? await getCursorApiKey(userId) : undefined;
  const installationId = userId
    ? await getGithubInstallationId(userId)
    : undefined;
  if (!apiKey && !installationId) return tasks;

  // ponytail: serial + per-poll: up to 2 Cursor calls per running task and 1
  // GitHub call per open PR (token minted per merge check). Serial because
  // updateTask read-modify-writes one JSON file and parallel writes clobber.
  // Fine for a handful of tasks; move to a webhook if it ever gets chatty.
  const out: Task[] = [];
  // grouped tasks share a cursorAgentId / prUrl — poll each once, not per member
  const runCache = new Map<string, LatestRun | undefined>();
  const mergedCache = new Map<string, boolean>();
  for (const task of tasks) {
    const patch: Partial<Task> = {};
    try {
      if (apiKey && needsRunPoll(task)) {
        const agentId = task.cursorAgentId!;
        const run = runCache.has(agentId)
          ? runCache.get(agentId)
          : await getLatestRun(agentId, apiKey);
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
      // a real GitHub merge — not the manual toggle — is what archives to "MERGED"
      if (installationId && needsMergePoll(task)) {
        const prUrl = task.prUrl!;
        const merged = mergedCache.has(prUrl)
          ? mergedCache.get(prUrl)!
          : await checkMerged(prUrl, installationId);
        mergedCache.set(prUrl, merged);
        if (merged) {
          patch.status = "done";
          patch.mergedAt = new Date().toISOString();
        }
      }
    } catch {
      // transient Cursor/GitHub error (incl. 403 before PR-read scope) — leave
      // the task as-is; the next poll retries.
    }
    // only write when something changed — this runs every client poll
    out.push(
      Object.keys(patch).length
        ? ((await updateTask(task.id, patch)) ?? task)
        : task,
    );
  }
  return out;
}

export async function GET() {
  return Response.json(await refresh(await listTasks()));
}

export async function POST(request: Request) {
  const { title, repoUrl } = await request.json().catch(() => ({}));
  if (typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "title required" }, { status: 400 });
  }
  if (typeof repoUrl !== "string" || !repoUrl.trim()) {
    return Response.json({ error: "repoUrl required" }, { status: 400 });
  }
  return Response.json(
    await addTask(title.trim(), repoUrl.trim()),
    { status: 201 },
  );
}

/** Persists a new order/grouping. Only id + groupId are accepted per entry. */
export async function PUT(request: Request) {
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
      order.map((e: { id: string; groupId: string | null }) => ({
        id: e.id,
        groupId: e.groupId,
      })),
    ),
  );
}
