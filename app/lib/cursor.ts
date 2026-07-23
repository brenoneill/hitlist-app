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
 * @throws If `CURSOR_API_KEY` is missing or the Cursor API rejects the request.
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

/**
 * Reads the status of an agent's most recent run.
 *
 * The agent's own `status` is only ACTIVE/ARCHIVED — execution state lives on runs,
 * so this hops agent -> latestRunId -> run.
 *
 * @param agentId - Cursor agent id.
 * @param apiKey - Cursor API key.
 * @returns The latest run's status, or undefined if the agent has no run yet.
 * @throws If the Cursor API rejects either request.
 */
export async function getLatestRunStatus(
  agentId: string,
  apiKey: string,
): Promise<RunStatus | undefined> {
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
  // ponytail: git.branches[].prUrl is on this response too — grab it when the
  // "keep link to PR in item list" task comes up.
  const { status } = await get(`${agentId}/runs/${latestRunId}`);
  return status;
}
