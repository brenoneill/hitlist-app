import { createSign } from "node:crypto";
import type { PrState } from "./tasks";

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

// tokens live an hour — minting one per PR poll would double every GitHub call
const tokens = new Map<string, { token: string; expires: number }>();

async function getInstallationToken(installationId: string): Promise<string> {
  const cached = tokens.get(installationId);
  if (cached && cached.expires > Date.now()) return cached.token;
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
  const body = (await res.json()) as { token: string; expires_at: string };
  tokens.set(installationId, {
    token: body.token,
    expires: Date.parse(body.expires_at) - 60_000, // a minute of slack
  });
  return body.token;
}

// The GitHub App backing this holds Metadata, Pull requests and Deployments, all
// read-only — no Contents, so there is no code-reading capability to misuse even
// server-side.
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

/**
 * Reads a PR's state from its html url (needs Pull requests: Read).
 * @returns "open", or the terminal "merged" / "closed" — polling stops on those.
 *   An unreadable PR (unparseable url, 404) counts as closed so it stops too.
 */
export async function getPrState(
  prUrl: string,
  installationId: string,
): Promise<PrState> {
  const m = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) return "closed";
  const token = await getInstallationToken(installationId);
  const res = await fetch(
    `https://api.github.com/repos/${m[1]}/${m[2]}/pulls/${m[3]}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (res.status === 404) return "closed"; // deleted, or app not installed there
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const pr = (await res.json()) as { merged: boolean; state: string };
  return pr.merged ? "merged" : pr.state === "closed" ? "closed" : "open";
}

/**
 * The preview URL for `branch`, read from GitHub Deployments (needs Deployments: Read).
 * Vercel, Netlify, Render and Cloudflare Pages all report their preview through this
 * API as `environment_url`, so nothing here is vendor-specific and no provider token
 * is needed — the deploy itself still happens entirely on the provider's side.
 * @returns The url, or undefined when nothing has deployed the branch successfully yet.
 */
export async function getPreviewUrl(
  repoUrl: string,
  branch: string,
  installationId: string,
): Promise<string | undefined> {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!m) return undefined;
  const token = await getInstallationToken(installationId);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
  // newest first, so one row is the current deployment for this branch
  const deploys = await fetch(
    `https://api.github.com/repos/${m[1]}/${m[2]}/deployments?ref=${encodeURIComponent(branch)}&per_page=1`,
    { headers },
  );
  if (deploys.status === 404) return undefined;
  if (!deploys.ok) throw new Error(`GitHub API ${deploys.status}`);
  const [deployment] = (await deploys.json()) as { statuses_url: string }[];
  if (!deployment) return undefined;
  // a deployment collects queued/in_progress/success statuses; only a success carries
  // a usable url, and several providers may have deployed the same ref
  const statuses = await fetch(`${deployment.statuses_url}?per_page=10`, {
    headers,
  });
  if (statuses.status === 404) return undefined;
  if (!statuses.ok) throw new Error(`GitHub API ${statuses.status}`);
  const rows = (await statuses.json()) as {
    state: string;
    environment_url?: string | null;
  }[];
  return rows.find((s) => s.state === "success" && s.environment_url)
    ?.environment_url as string | undefined;
}
