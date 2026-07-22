import { createSign } from "node:crypto";

interface GitHubRepo {
  id: number;
  full_name: string;
  html_url: string;
  private: boolean;
}

function appId(): string {
  const id = process.env.GITHUB_APP_ID;
  if (!id) throw new Error("GITHUB_APP_ID not set");
  return id;
}

function privateKey(): string {
  const key = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!key) throw new Error("GITHUB_APP_PRIVATE_KEY not set");
  // .env stores the PEM with literal \n escapes since it can't hold real newlines
  return key.replace(/\\n/g, "\n");
}

function signAppJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 60, exp: now + 600, iss: appId() };
  const unsigned = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(privateKey(), "base64url");
  return `${unsigned}.${signature}`;
}

async function getInstallationToken(installationId: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${signAppJwt()}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`GitHub App token exchange failed: ${res.status}`);
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}

// Only ever calls the Metadata-read-only "list repos this installation can see"
// endpoint — the GitHub App backing this has no Contents permission, so there is
// no code-reading capability to misuse even server-side.
export async function listInstallationRepos(
  installationId: string,
): Promise<GitHubRepo[]> {
  const token = await getInstallationToken(installationId);
  const res = await fetch(
    "https://api.github.com/installation/repositories?per_page=100",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}`);
  }
  const body = (await res.json()) as { repositories: GitHubRepo[] };
  return body.repositories;
}
