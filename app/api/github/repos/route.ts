import { requireUserId } from "@/auth";
import { getGithubInstallationId } from "@/app/lib/userSettings";
import { listInstallationRepos } from "@/app/lib/githubApp";
import type { Repo } from "@/app/components/GithubRepos";

export async function GET() {
  try {
    const userId = await requireUserId();
    if (userId instanceof Response) return userId;

    const installationId = await getGithubInstallationId(userId);
    if (!installationId) {
      return Response.json({ connected: false, repos: [] });
    }

    const repos = await listInstallationRepos(installationId);
    return Response.json({
      connected: true,
      // typed against the client's Repo so contract drift fails typecheck
      repos: repos.map((r): Repo => ({
        id: r.id,
        name: r.full_name,
        url: r.html_url,
        private: r.private,
      })),
    });
  } catch (err) {
    console.error("GET /api/github/repos failed:", err);
    return Response.json({ error: "failed to load repos" }, { status: 500 });
  }
}
