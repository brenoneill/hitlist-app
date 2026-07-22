import { auth } from "@/auth";
import { getGithubInstallationId } from "@/app/lib/userSettings";
import { listInstallationRepos } from "@/app/lib/githubApp";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "not signed in" }, { status: 401 });
    }

    const installationId = await getGithubInstallationId(session.user.id);
    if (!installationId) {
      return Response.json({ connected: false, repos: [] });
    }

    const repos = await listInstallationRepos(installationId);
    return Response.json({
      connected: true,
      repos: repos.map((r) => ({
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
