import { requireUserId } from "@/auth";
import { getPrDetails, listDeployments } from "@/app/lib/githubApp";
import { getTask } from "@/app/lib/tasks";
import { getGithubInstallationId } from "@/app/lib/userSettings";

// Canned PR for AUTH_E2E runs, where no GitHub App exists — makes the whole
// review tab renderable and screenshot-able without credentials.
const E2E_PR_FIXTURE = {
  number: 1,
  title: "Collapse repo sections by default",
  body:
    "<!-- CURSOR_AGENT_PR_BODY_BEGIN -->\n" +
    "### TL;DR\n" +
    "Repos in settings now start collapsed; tap a header to expand.\n\n" +
    "### Data shape\n" +
    "No data shape changes.\n\n" +
    "### Components\n" +
    "- Reused fold chrome in `RepoSections` (`details` / `summary`).\n" +
    "- Persistence helpers live in `app/settings/persist.ts`.\n\n" +
    "### Rationale\n" +
    "- Collapsed by default keeps the phone review short.\n" +
    "- Open state is per-repo in `localStorage`, not a new settings field.\n\n" +
    "### Review guide\n" +
    "1. **`app/settings/RepoSections.tsx`** — **review**: open state persistence.\n" +
    "2. **`app/settings/persist.ts`** — **mechanical**: localStorage helpers.\n\n" +
    '<img src="https://placehold.co/640x360/png?text=Collapsed" alt="Repos collapsed by default">\n' +
    '<img src="https://placehold.co/640x400/png?text=Expanded" alt="Expanded on tap">\n\n' +
    "<details><summary>Notes</summary>State persists per repo in localStorage.</details>\n" +
    "<!-- CURSOR_AGENT_PR_BODY_END -->\n" +
    '<div><a href="https://cursor.com/agents/bc-e2e-fixture">' +
    '<img alt="Open in Cursor" src="https://cursor.com/assets/images/open-in-web-dark.png">' +
    "</a></div>",
  state: "open",
  draft: false,
  createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
  mergedAt: undefined,
  headRef: "feat/preview-links",
  headSha: "e2e0000",
  baseRef: "main",
  additions: 48,
  deletions: 13,
  changedFiles: 3,
  files: [
    {
      filename: "app/settings/RepoSections.tsx",
      status: "modified",
      additions: 30,
      deletions: 12,
      patch:
        "@@ -10,7 +10,8 @@ export function RepoSections({ repos }: Props) {\n" +
        "   return (\n" +
        "     <div>\n" +
        "       {repos.map((repo) => (\n" +
        '-        <details key={repo.id} open>\n' +
        '+        <details key={repo.id} open={isOpen(repo.id)}\n' +
        '+          onToggle={(e) => persist(repo.id, e.currentTarget.open)}>\n' +
        "           <summary>{repo.name}</summary>\n" +
        "           <RepoList repo={repo} />\n" +
        "         </details>\n" +
        "@@ -42,6 +43,10 @@ function RepoList({ repo }: { repo: Repo }) {\n" +
        "   );\n" +
        " }\n" +
        " \n" +
        "+function isOpen(id: string): boolean {\n" +
        '+  return localStorage.getItem(`repo-open-${id}`) === "1";\n' +
        "+}\n" +
        "+",
    },
    {
      filename: "app/settings/persist.ts",
      status: "added",
      additions: 18,
      deletions: 0,
      patch:
        "@@ -0,0 +1,6 @@\n" +
        "+export function persist(id: string, open: boolean) {\n" +
        "+  if (open) localStorage.setItem(`repo-open-${id}`, \"1\");\n" +
        "+  else localStorage.removeItem(`repo-open-${id}`);\n" +
        "+}\n" +
        "+\n" +
        "+export const PREFIX = \"repo-open-\";",
    },
    {
      filename: "public/settings-collapsed.png",
      status: "added",
      additions: 0,
      deletions: 0,
    },
  ],
  deployments: [
    {
      environment: "Preview",
      state: "success",
      url: "https://example.com/preview",
    },
  ],
};

/**
 * The task's PR — metadata plus per-file diffs — for the workspace review
 * screen. Read live from GitHub on every call; nothing is stored.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/tasks/[id]/pr">,
) {
  if (process.env.AUTH_E2E === "1") return Response.json(E2E_PR_FIXTURE);

  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  const task = await getTask(userId, id);
  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }
  if (!task.prUrl) {
    return Response.json({ error: "task has no PR yet" }, { status: 400 });
  }
  const installationId = await getGithubInstallationId(userId);
  if (!installationId) {
    return Response.json(
      { error: "connect GitHub in Settings to review PRs here" },
      { status: 400 },
    );
  }

  try {
    const details = await getPrDetails(task.prUrl, installationId);
    if (!details) {
      return Response.json({ error: "PR not found on GitHub" }, { status: 404 });
    }
    // deployments are a bonus — a Deployments 403 must not blank out the diff
    const deployments = task.repoUrl
      ? await listDeployments(
          task.repoUrl,
          details.headSha, // a sha skips the branch-tip lookup inside
          installationId,
          3,
        ).catch(() => undefined)
      : undefined;
    return Response.json({ ...details, deployments });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
