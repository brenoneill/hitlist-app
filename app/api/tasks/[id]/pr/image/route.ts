import { requireUserId } from "@/auth";
import { fetchGithubAsset } from "@/app/lib/githubApp";
import { getTask } from "@/app/lib/tasks";
import { getGithubInstallationId } from "@/app/lib/userSettings";

/** Only GitHub asset hosts go through the proxy — anything else is not ours to fetch. */
function isAllowedHost(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    (url.hostname === "github.com" ||
      url.hostname.endsWith(".githubusercontent.com"))
  );
}

/**
 * Streams a PR screenshot through the server with the installation token, so
 * private-repo assets render in the workspace (a cross-site <img> load carries
 * no github.com cookies). Any failure redirects to the original URL — public
 * images then load directly and the client's onError fallback covers the rest.
 */
export async function GET(
  req: Request,
  ctx: RouteContext<"/api/tasks/[id]/pr/image">,
) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  const task = await getTask(userId, id);
  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }

  const raw = new URL(req.url).searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return Response.json({ error: "bad url" }, { status: 400 });
  }
  if (!isAllowedHost(target)) {
    return Response.redirect(target, 302);
  }

  const installationId = await getGithubInstallationId(userId);
  if (!installationId) return Response.redirect(target, 302);

  try {
    const res = await fetchGithubAsset(target.toString(), installationId);
    if (!res.ok || !res.body) return Response.redirect(target, 302);
    return new Response(res.body, {
      headers: {
        "content-type": res.headers.get("content-type") ?? "image/png",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return Response.redirect(target, 302);
  }
}
