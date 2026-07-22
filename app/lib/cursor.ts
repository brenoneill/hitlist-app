// Thin client for the Cursor Cloud Agents API (https://cursor.com/docs/cloud-agent/api).
const CREATE_URL = "https://api.cursor.com/v1/agents";

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
