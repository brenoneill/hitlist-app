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

// The GitHub App backing this holds Metadata and Deployments (read-only) plus
// Pull requests and Contents (read & write) — write is required by the in-app
// merge (PUT pulls/{n}/merge writes to the base branch). Installations that
// predate the write bump keep working read-only; merge 403s until re-approved.
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

/** "https://github.com/o/r(.git)" → [o, r]; tolerates dots in repo names. */
function ownerRepo(repoUrl: string): [string, string] | undefined {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:[/?#]|$)/);
  return m ? [m[1], m[2]] : undefined;
}

/**
 * Finds the html url of the PR whose head is `branch` (needs Pull requests: Read).
 * Used when a provider reports a branch but not a PR url (Copilot's pull artifact
 * only carries ids, and Agent-tasks PATs often can't resolve them).
 * @returns The PR's html url, or undefined when none exists yet / repo is unreadable.
 */
export async function getPrUrlForBranch(
  repoUrl: string,
  branch: string,
  installationId: string,
): Promise<string | undefined> {
  const parsed = ownerRepo(repoUrl);
  if (!parsed) return undefined;
  const [owner, repo] = parsed;
  const token = await getInstallationToken(installationId);
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=all&per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const pulls = (await res.json()) as { html_url?: string }[];
  return pulls[0]?.html_url;
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

export interface PrFile {
  filename: string;
  /** GitHub's per-file status: added | removed | modified | renamed | … */
  status: string;
  additions: number;
  deletions: number;
  /** Unified diff hunks; absent for binary or oversized files. */
  patch?: string;
}

export interface PrDetails {
  number: number;
  title: string;
  body?: string;
  state: PrState;
  /** True while the PR is still a GitHub draft (agents open drafts by default). */
  draft: boolean;
  headRef: string;
  /** Tip commit of the head branch — what deployments are registered against. */
  headSha: string;
  baseRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  files: PrFile[];
  /** Filled in by the route, not by `getPrDetails` — absent if Deployments 403s. */
  deployments?: Deployment[];
}

/**
 * A PR's metadata and per-file diffs, for the in-app review screen
 * (needs Pull requests: Read).
 * @returns The details, or undefined when the url is unparseable or the PR 404s.
 */
export async function getPrDetails(
  prUrl: string,
  installationId: string,
): Promise<PrDetails | undefined> {
  const m = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) return undefined;
  const token = await getInstallationToken(installationId);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
  const base = `https://api.github.com/repos/${m[1]}/${m[2]}/pulls/${m[3]}`;
  const prRes = await fetch(base, { headers });
  if (prRes.status === 404) return undefined;
  if (!prRes.ok) throw new Error(`GitHub API ${prRes.status}`);
  const pr = (await prRes.json()) as {
    number: number;
    title: string;
    body: string | null;
    merged: boolean;
    state: string;
    draft: boolean;
    head: { ref: string; sha: string };
    base: { ref: string };
    additions: number;
    deletions: number;
    changed_files: number;
  };
  // ponytail: 100-file cap, paginate if an agent PR ever exceeds it
  const filesRes = await fetch(`${base}/files?per_page=100`, { headers });
  if (!filesRes.ok) throw new Error(`GitHub API ${filesRes.status}`);
  const files = (await filesRes.json()) as PrFile[];
  return {
    number: pr.number,
    title: pr.title,
    body: pr.body ?? undefined,
    state: pr.merged ? "merged" : pr.state === "closed" ? "closed" : "open",
    draft: pr.draft,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    baseRef: pr.base.ref,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    files: files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    })),
  };
}

/**
 * Marks a draft PR ready for review (needs Pull requests: Write).
 * GitHub rejects REST PATCH `draft: false`; this uses the GraphQL
 * `markPullRequestReadyForReview` mutation with the PR's `node_id`.
 * Idempotent when the PR is already ready.
 * @throws GitHub's own message so the UI can show it.
 */
export async function markPrReady(
  prUrl: string,
  installationId: string,
): Promise<void> {
  const m = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) throw new Error("unrecognized PR url");
  const token = await getInstallationToken(installationId);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
  const prRes = await fetch(
    `https://api.github.com/repos/${m[1]}/${m[2]}/pulls/${m[3]}`,
    { headers },
  );
  if (prRes.status === 404) throw new Error("PR not found on GitHub");
  if (!prRes.ok) throw new Error(`GitHub API ${prRes.status}`);
  const pr = (await prRes.json()) as { draft: boolean; node_id: string };
  if (!pr.draft) return;

  const gqlRes = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `mutation($id: ID!) {
        markPullRequestReadyForReview(input: { pullRequestId: $id }) {
          pullRequest { isDraft }
        }
      }`,
      variables: { id: pr.node_id },
    }),
  });
  if (!gqlRes.ok) {
    const body = (await gqlRes.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(body.message ?? `GitHub API ${gqlRes.status}`);
  }
  const body = (await gqlRes.json()) as {
    errors?: { message: string }[];
  };
  if (body.errors?.length) {
    throw new Error(body.errors[0].message);
  }
}

/**
 * Merges a PR (needs Pull requests: Write + Contents: Write).
 * @throws GitHub's own message ("Pull Request is not mergeable", "Resource not
 *   accessible…" before the permission bump is approved) so the UI can show it.
 */
// ponytail: squash only; add a method picker if anyone asks
export async function mergePr(
  prUrl: string,
  installationId: string,
): Promise<void> {
  const m = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) throw new Error("unrecognized PR url");
  const token = await getInstallationToken(installationId);
  const res = await fetch(
    `https://api.github.com/repos/${m[1]}/${m[2]}/pulls/${m[3]}/merge`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ merge_method: "squash" }),
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `GitHub API ${res.status}`);
  }
}

export interface Deployment {
  /** Whatever the provider named it — "Preview", "Preview – hitlist-app", … */
  environment: string;
  /** queued | in_progress | success | failure | error | inactive */
  state: string;
  /** The deployed url; only a successful status carries one. */
  url?: string;
}

/**
 * The deployments for a branch or commit, newest first, read from GitHub Deployments
 * (needs Deployments: Read). Vercel, Netlify, Render and Cloudflare Pages all report
 * their preview through this API as `environment_url`, so nothing here is
 * vendor-specific and no provider token is needed — the deploy itself still happens
 * entirely on the provider's side.
 *
 * Filtered by commit sha, never by `?ref=`: Vercel registers each deployment under the
 * sha, so `?ref=my-branch` matches nothing even when the preview is live. A branch is
 * resolved to its tip first, which costs an extra request — pass a sha when you have
 * one (the PR read already does).
 *
 * @param ref A branch name or a 40-char commit sha.
 * @param limit How many deployments to read; each one costs a second request for its
 *   statuses, so the polling caller stays at 1 and the workspace asks for a few.
 */
export async function listDeployments(
  repoUrl: string,
  ref: string,
  installationId: string,
  limit = 1,
): Promise<Deployment[]> {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!m) return [];
  const token = await getInstallationToken(installationId);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
  const repo = `https://api.github.com/repos/${m[1]}/${m[2]}`;

  let sha = ref;
  if (!/^[0-9a-f]{40}$/i.test(ref)) {
    // slashes in branch names are part of the path, so no encoding here
    const tip = await fetch(`${repo}/git/ref/heads/${ref}`, { headers });
    if (!tip.ok) return []; // branch deleted after a merge, or never pushed
    sha = ((await tip.json()) as { object: { sha: string } }).object.sha;
  }

  // newest first, so the first row is the current deployment for this commit
  const deploys = await fetch(
    `${repo}/deployments?sha=${sha}&per_page=${limit}`,
    { headers },
  );
  if (deploys.status === 404) return [];
  if (!deploys.ok) throw new Error(`GitHub API ${deploys.status}`);
  const rows = (await deploys.json()) as {
    environment: string;
    statuses_url: string;
  }[];
  return (
    await Promise.all(
      rows.map(async (d): Promise<Deployment | undefined> => {
        // a deployment collects queued/in_progress/success statuses, newest first;
        // only a success carries a usable url
        const res = await fetch(`${d.statuses_url}?per_page=10`, { headers });
        if (!res.ok) return undefined;
        const statuses = (await res.json()) as {
          state: string;
          environment_url?: string | null;
        }[];
        if (!statuses.length) return undefined;
        return {
          environment: d.environment,
          state: statuses[0].state,
          url:
            statuses.find((s) => s.state === "success" && s.environment_url)
              ?.environment_url ?? undefined,
        };
      }),
    )
  ).filter((d): d is Deployment => !!d);
}

/**
 * The preview URL for `branch` — the newest deployment's url, once it has succeeded.
 * @returns The url, or undefined when nothing has deployed the branch successfully yet.
 */
// ponytail: 3 requests per poll (branch tip → deployments → statuses); pass the PR head
// sha from the task instead if the poll budget ever gets tight
export async function getPreviewUrl(
  repoUrl: string,
  branch: string,
  installationId: string,
): Promise<string | undefined> {
  const [deployment] = await listDeployments(repoUrl, branch, installationId);
  return deployment?.url;
}

/**
 * Fetches a GitHub-hosted PR asset (screenshot in a PR body) with the
 * installation token, for the image proxy. A cross-site <img> load carries no
 * github.com cookies, so private-repo assets are unreachable from the browser.
 * ponytail: installation tokens may not authorize every attachment host — the
 * caller falls back to a redirect when this fails.
 */
export async function fetchGithubAsset(
  url: string,
  installationId: string,
): Promise<Response> {
  const token = await getInstallationToken(installationId);
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "follow",
  });
}
