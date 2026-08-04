// Thin client for the GitHub Copilot Agent Tasks API (public preview).
// https://docs.github.com/en/rest/agent-tasks/agent-tasks
import type { CreatedAgent, CursorModel, LatestRun, RunStatus } from "./cursor";

const API = "https://api.github.com/agents/repos";

const headers = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2026-03-10",
  "Content-Type": "application/json",
});

/** Copilot task state → the stored Cursor-shaped RunStatus union. */
export const STATE_MAP: Record<string, RunStatus> = {
  queued: "CREATING",
  in_progress: "RUNNING",
  completed: "FINISHED",
  failed: "ERROR",
  cancelled: "CANCELLED",
  timed_out: "EXPIRED",
  // ponytail: no "paused" in the stored union; the agent resumes after the user
  // replies on the GitHub task page, so keep polling.
  waiting_for_user: "RUNNING",
  // ponytail: session over ⇒ terminal, else the 10s poll never stops; revisit if
  // idle tasks turn out to resume.
  idle: "FINISHED",
};

/** "https://github.com/o/r(.git)" → [o, r]; tolerates dots in repo names. */
function ownerRepo(repoUrl: string): [string, string] {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:[/?#]|$)/);
  if (!m) throw new Error(`not a GitHub repo url: ${repoUrl}`);
  return [m[1], m[2]];
}

async function call(url: string, apiKey: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: headers(apiKey) });
  if (!res.ok) {
    throw new Error(`Copilot API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Starts a Copilot cloud agent task against the given repository.
 * Same shape as cursor.createAgent so the provider registry can swap them.
 */
export async function createAgent(
  text: string,
  repoUrl: string,
  ref: string | undefined,
  apiKey: string,
  modelId?: string,
): Promise<CreatedAgent> {
  const [owner, repo] = ownerRepo(repoUrl);
  const task = await call(`${API}/${owner}/${repo}/tasks`, apiKey, {
    method: "POST",
    body: JSON.stringify({
      prompt: text,
      create_pull_request: true, // parity with Cursor's autoCreatePR
      ...(ref ? { base_ref: ref } : {}),
      ...(modelId ? { model: modelId } : {}),
    }),
  });
  return {
    id: String(task.id),
    url:
      task.html_url ??
      `https://github.com/${owner}/${repo}/agents/tasks/${task.id}`,
    status: task.state,
  };
}

interface Artifact {
  type: string;
  data?: { global_id?: string; head_ref?: string };
}

/**
 * The pull artifact carries only the PR's node/database id — no number, no url —
 * and REST has no lookup by either, so resolve the node id through GraphQL.
 * @returns The PR's html url, or undefined if it can't be read (never a guessed url).
 */
async function prUrlFromNodeId(
  globalId: string,
  apiKey: string,
): Promise<string | undefined> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      query: "query($id:ID!){node(id:$id){... on PullRequest{url}}}",
      variables: { id: globalId },
    }),
  });
  if (!res.ok) return undefined;
  const body = (await res.json()) as { data?: { node?: { url?: string } } };
  return body.data?.node?.url;
}

/**
 * Lists PRs by head branch — works when the PAT can read pulls but GraphQL
 * node lookup (or a missing global_id) fails. Agent-tasks-only PATs still 403.
 * @returns The newest matching PR's html url, or undefined.
 */
async function prUrlFromBranch(
  owner: string,
  repo: string,
  branch: string,
  apiKey: string,
): Promise<string | undefined> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=all&per_page=1`,
    { headers: headers(apiKey) },
  );
  if (!res.ok) return undefined;
  const pulls = (await res.json()) as { html_url?: string }[];
  return pulls[0]?.html_url;
}

/**
 * Resolves a PR url from Copilot artifacts: GraphQL via global_id first, then
 * REST by head branch. Never invents a url — undefined means "not readable yet".
 */
async function resolvePrUrl(
  artifacts: Artifact[],
  owner: string,
  repo: string,
  apiKey: string,
): Promise<string | undefined> {
  const pullNodeId = artifacts.find((a) => a.type === "pull")?.data?.global_id;
  if (pullNodeId) {
    const fromNode = await prUrlFromNodeId(pullNodeId, apiKey);
    if (fromNode) return fromNode;
  }
  const branch = artifacts.find((a) => a.type === "branch")?.data?.head_ref;
  if (!branch) return undefined;
  return prUrlFromBranch(owner, repo, branch, apiKey);
}

/**
 * Reads a task's current state, normalized to the stored RunStatus union.
 * repoUrl is required — the Copilot GET is repo-scoped.
 */
export async function getLatestRun(
  agentId: string,
  repoUrl: string | undefined,
  apiKey: string,
): Promise<LatestRun | undefined> {
  if (!repoUrl) throw new Error("copilot task has no repo url");
  const [owner, repo] = ownerRepo(repoUrl);
  const task = await call(`${API}/${owner}/${repo}/tasks/${agentId}`, apiKey);
  const artifacts = (task.artifacts ?? []) as Artifact[];
  const branch = artifacts.find((a) => a.type === "branch")?.data?.head_ref;
  return {
    // Copilot has no separate run id — the task is the unit of work.
    id: agentId,
    status: STATE_MAP[task.state] ?? "RUNNING",
    // no summary field in the API — the PR body carries the write-up
    branch,
    prUrl: await resolvePrUrl(artifacts, owner, repo, apiKey),
  };
}

// ponytail: no models endpoint in the API — static documented list.
const MODELS = [
  "claude-sonnet-4.6",
  "claude-opus-4.6",
  "gpt-5.2-codex",
  "gpt-5.3-codex",
  "gpt-5.4",
];

export async function listModels(_apiKey: string): Promise<CursorModel[]> {
  return MODELS.map((id) => ({ id, displayName: id }));
}
