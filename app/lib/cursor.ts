// Thin client for the Cursor Cloud Agents API (https://cursor.com/docs/cloud-agent/api).
const CREATE_URL = "https://api.cursor.com/v1/agents";

export interface CreatedAgent {
  id: string;
  url: string;
  status: string;
}

export async function createAgent(
  text: string,
  repoUrl: string,
  ref: string,
): Promise<CreatedAgent> {
  const key = process.env.CURSOR_API_KEY;
  if (!key) throw new Error("CURSOR_API_KEY not set");

  const res = await fetch(CREATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
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
