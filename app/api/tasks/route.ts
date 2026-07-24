import { auth } from "@/auth";
import {
  addTask,
  listTasks,
  reorderTasks,
  updateTask,
  type PrState,
  type Task,
} from "@/app/lib/tasks";
import { getLatestRun, type LatestRun, type RunStatus } from "@/app/lib/cursor";
import { getPrState } from "@/app/lib/githubApp";
import {
  getCursorApiKey,
  getGithubInstallationId,
} from "@/app/lib/userSettings";

const TERMINAL: Partial<Record<RunStatus, Task["status"]>> = {
  FINISHED: "done",
  ERROR: "failed",
  CANCELLED: "failed",
  EXPIRED: "failed",
};

/** Poll until the agent's run has been seen terminal once; then it can't change. */
const needsPoll = (t: Task) =>
  !!t.cursorAgentId && !(t.runStatus && t.runStatus in TERMINAL);

/** Poll a PR until it's merged or closed; unpolled (no prState) counts as open. */
const needsPrPoll = (t: Task) => !!t.prUrl && (t.prState ?? "open") === "open";

/**
 * Brings dispatched tasks up to date with their Cursor run: status, branch,
 * PR url, final summary — then with their PR's state on GitHub. Only `running`
 * tasks get their status remapped — a manually toggled done/inbox task keeps
 * its toggle, but still captures the PR. Each half no-ops without its
 * credential, so a signed-out caller just gets the stored tasks back.
 */
async function refresh(tasks: Task[]): Promise<Task[]> {
  const session = await auth();
  const userId = session?.user?.id;
  const apiKey = userId && (await getCursorApiKey(userId));
  const installationId = userId && (await getGithubInstallationId(userId));
  if (!apiKey && !installationId) return tasks;

  // ponytail: serial, a couple of API calls per unfinished task per poll. Serial
  // because updateTask read-modify-writes one JSON file and parallel writes
  // clobber. Fine for a handful of tasks; move to webhooks if it gets chatty.
  const out: Task[] = [];
  // grouped tasks share a cursorAgentId / prUrl — poll each once, not per member
  const runs = new Map<string, LatestRun | undefined>();
  const prs = new Map<string, PrState>();
  for (const task of tasks) {
    const patch: Partial<Task> = {};
    if (apiKey && task.cursorAgentId && needsPoll(task)) {
      try {
        const run = runs.has(task.cursorAgentId)
          ? runs.get(task.cursorAgentId)
          : await getLatestRun(task.cursorAgentId, apiKey);
        runs.set(task.cursorAgentId, run);
        if (run) {
          const next = TERMINAL[run.status];
          if (next && task.status === "running") patch.status = next;
          if (run.status !== task.runStatus) patch.runStatus = run.status;
          if (run.branch && run.branch !== task.branch)
            patch.branch = run.branch;
          if (run.prUrl && run.prUrl !== task.prUrl) patch.prUrl = run.prUrl;
          if (run.summary && run.summary !== task.agentSummary) {
            patch.agentSummary = run.summary;
          }
        }
      } catch {
        // transient Cursor error — leave it running, next poll retries
      }
    }
    // a PR url that only just arrived is checked on the next poll, not this one
    if (installationId && needsPrPoll(task)) {
      try {
        const state =
          prs.get(task.prUrl!) ?? (await getPrState(task.prUrl!, installationId));
        prs.set(task.prUrl!, state);
        if (state !== task.prState) patch.prState = state;
      } catch {
        // transient GitHub error — next poll retries
      }
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
  const repo =
    typeof repoUrl === "string" && repoUrl.trim() ? repoUrl.trim() : undefined;
  return Response.json(await addTask(title.trim(), repo), { status: 201 });
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
