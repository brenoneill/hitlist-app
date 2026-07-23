// Thin client for the Cursor Cloud Agents API (https://cursor.com/docs/cloud-agent/api).
const CREATE_URL = "https://api.cursor.com/v1/agents";

/** Terminal + in-flight run states returned by the Cursor API. */
export type RunStatus =
  | "CREATING"
  | "RUNNING"
  | "FINISHED"
  | "ERROR"
  | "CANCELLED"
  | "EXPIRED";

export interface CreatedAgent {
  id: string;
  url: string;
  status: string;
}

/**
 * Creates a Cursor cloud agent against the given repository.
 * @param text - Prompt text sent to the agent.
 * @param repoUrl - GitHub repository URL the agent should work in.
 * @param ref - Branch or commit SHA used as the starting point.
 * @returns The created agent id, dashboard url, and status.
 * @throws If the Cursor API rejects the request.
 */
export async function createAgent(
  text: string,
  repoUrl: string,
  ref: string,
  apiKey: string,
): Promise<CreatedAgent> {
  const res = await fetch(CREATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: { text },
      repos: [{ url: repoUrl, startingRef: ref }],
      autoCreatePR: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Cursor API ${res.status}: ${await res.text()}`);
  }

  const { agent } = await res.json();
  return { id: agent.id, url: agent.url, status: agent.status };
}

export interface LatestRun {
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
  const get = async (path: string) => {
    const res = await fetch(`${CREATE_URL}/${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Cursor API ${res.status}: ${await res.text()}`);
    }
    return res.json();
  };

  const { latestRunId } = await get(agentId);
  if (!latestRunId) return undefined;
  const run = await get(`${agentId}/runs/${latestRunId}`);
  const branch = run.git?.branches?.[0];
  return {
    status: run.status,
    summary: run.result,
    branch: branch?.branch,
    prUrl: branch?.prUrl,
  };
}
