// Thin client for the Cursor Cloud Agents API (https://cursor.com/docs/cloud-agent/api).
const CREATE_URL = "https://api.cursor.com/v1/agents";
const MODELS_URL = "https://api.cursor.com/v1/models";

/** Terminal + in-flight run states returned by the Cursor API. */
export type RunStatus =
  | "CREATING"
  | "RUNNING"
  | "FINISHED"
  | "ERROR"
  | "CANCELLED"
  | "EXPIRED";

/** Run states past which nothing changes, so polling can stop. */
export const TERMINAL_RUN: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "FINISHED",
  "ERROR",
  "CANCELLED",
  "EXPIRED",
]);

export interface CreatedAgent {
  id: string;
  url: string;
  status: string;
}

/**
 * Creates a Cursor cloud agent against the given repository.
 * @param text - Prompt text sent to the agent.
 * @param repoUrl - GitHub repository URL the agent should work in.
 * @param ref - Branch or commit SHA to start from; omit for the repo's default branch.
 * @param apiKey - Cursor API key.
 * @param modelId - Model id from `listModels`; omit to use the account's default model.
 * @returns The created agent id, dashboard url, and status.
 * @throws If the Cursor API rejects the request.
 */
export async function createAgent(
  text: string,
  repoUrl: string,
  ref: string | undefined,
  apiKey: string,
  modelId?: string,
): Promise<CreatedAgent> {
  const res = await fetch(CREATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: { text },
      repos: [{ url: repoUrl, ...(ref ? { startingRef: ref } : {}) }],
      autoCreatePR: true,
      ...(modelId ? { model: { id: modelId } } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Cursor API ${res.status}: ${await res.text()}`);
  }

  const { agent } = await res.json();
  return { id: agent.id, url: agent.url, status: agent.status };
}

export interface CursorModel {
  id: string;
  displayName: string;
}

/**
 * Lists models available for cloud agents.
 * @param apiKey - Cursor API key.
 * @returns Available models (id + display name).
 * @throws If the Cursor API rejects the request.
 */
export async function listModels(apiKey: string): Promise<CursorModel[]> {
  const res = await fetch(MODELS_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Cursor API ${res.status}: ${await res.text()}`);
  }
  const { items } = await res.json();
  return (items as { id: string; displayName?: string }[]).map((m) => ({
    id: m.id,
    displayName: m.displayName ?? m.id,
  }));
}

export interface LatestRun {
  /** Provider run id (Cursor run id; Copilot uses the task id). */
  id?: string;
  status: RunStatus;
  /** Final assistant response text — only present on terminal runs. */
  summary?: string;
  branch?: string;
  prUrl?: string;
}

/**
 * Reads an agent's most recent run: status, final summary, and branch/PR.
 *
 * The agent's own `status` is only ACTIVE/ARCHIVED — execution state lives on runs,
 * so this hops agent -> latestRunId -> run.
 *
 * @param agentId - Cursor agent id.
 * @param apiKey - Cursor API key.
 * @returns The latest run, or undefined if the agent has no run yet.
 * @throws If the Cursor API rejects either request.
 */
export async function getLatestRun(
  agentId: string,
  apiKey: string,
): Promise<LatestRun | undefined> {
  const { latestRunId } = await cursorGet(agentId, apiKey);
  if (!latestRunId) return undefined;
  const run = await cursorGet(`${agentId}/runs/${latestRunId}`, apiKey);
  const branch = run.git?.branches?.[0];
  return {
    id: latestRunId,
    status: run.status,
    summary: run.result,
    branch: branch?.branch,
    prUrl: branch?.prUrl,
  };
}

async function cursorGet(path: string, apiKey: string) {
  const res = await fetch(`${CREATE_URL}/${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Cursor API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Sends a follow-up prompt into an existing agent's conversation/workspace —
 * a new run on the same agent, pushing to the same branch/PR.
 * @throws If the Cursor API rejects the request.
 */
export async function sendFollowup(
  agentId: string,
  text: string,
  apiKey: string,
): Promise<void> {
  const res = await fetch(`${CREATE_URL}/${agentId}/runs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: { text } }),
  });
  if (!res.ok) {
    throw new Error(`Cursor API ${res.status}: ${await res.text()}`);
  }
}

export interface AgentRun {
  id: string;
  status: RunStatus;
  /** Run start time — orders agent replies between the user prompts that caused them. */
  createdAt: string;
}

/** Lists an agent's runs, oldest first (one run per prompt sent to the agent). */
export async function listRuns(
  agentId: string,
  apiKey: string,
): Promise<AgentRun[]> {
  const { items } = await cursorGet(`${agentId}/runs`, apiKey);
  return (items as AgentRun[]).map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
  }));
}

/** A terminated run's final assistant reply text, if any. */
export async function getRunResult(
  agentId: string,
  runId: string,
  apiKey: string,
): Promise<string | undefined> {
  const run = await cursorGet(`${agentId}/runs/${runId}`, apiKey);
  return run.result ?? undefined;
}
