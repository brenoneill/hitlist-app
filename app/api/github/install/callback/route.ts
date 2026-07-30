import { auth } from "@/auth";
import { setGithubInstallationId } from "@/app/lib/userSettings";

// GitHub redirects here after the user finishes picking repos on the App's
// installation screen (configured as the App's "Setup URL"). The browser
// navigation carries our own session cookie, so we just read who's signed in
// and remember which installation (i.e. which repos) they granted.
export async function GET(req: Request) {
  const url = new URL(req.url);
  // GitHub only allows one Setup URL (production's), so installs started from a
  // Vercel preview land here carrying the preview's origin in `state`. Bounce
  // the callback there so the preview's own session cookie can claim the
  // install. An installation_id is useless without our App's private key, so
  // leaking one to another *.vercel.app site is harmless.
  const state = url.searchParams.get("state");
  const target = state && URL.canParse(state) ? new URL(state) : null;
  if (
    target &&
    target.origin !== url.origin &&
    target.protocol === "https:" &&
    target.hostname.endsWith(".vercel.app")
  ) {
    url.searchParams.delete("state"); // one hop only — the preview handles it locally
    return Response.redirect(
      new URL(`${url.pathname}?${url.searchParams}`, target.origin),
    );
  }
  const session = await auth();
  const installationId = url.searchParams.get("installation_id");
  if (session?.user && installationId) {
    await setGithubInstallationId(session.user.id, installationId);
  }
  return Response.redirect(new URL("/", url));
}
