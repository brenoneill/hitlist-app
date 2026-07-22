import { auth } from "@/auth";
import { setGithubInstallationId } from "@/app/lib/userSettings";

// GitHub redirects here after the user finishes picking repos on the App's
// installation screen (configured as the App's "Setup URL"). The browser
// navigation carries our own session cookie, so we just read who's signed in
// and remember which installation (i.e. which repos) they granted.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = await auth();
  const installationId = url.searchParams.get("installation_id");
  if (session?.user && installationId) {
    await setGithubInstallationId(session.user.id, installationId);
  }
  return Response.redirect(new URL("/", url));
}
