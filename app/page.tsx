import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Landing } from "@/app/components/Landing";
import { listTasks } from "@/app/lib/tasks";
import { getProviderKeyFlags } from "@/app/lib/userSettings";

/**
 * Chooses where a signed-in user should enter the app from `/`.
 * Empty hit list + no Cursor key means first-time setup → Settings.
 *
 * @param userId - Stable Auth.js user id
 * @returns `/app/settings` for first-time setup, otherwise `/app`
 */
async function appEntryFor(userId: string): Promise<"/app" | "/app/settings"> {
  const [tasks, keys] = await Promise.all([
    listTasks(userId),
    getProviderKeyFlags(userId),
  ]);
  if (tasks.length === 0 && !keys.cursor) return "/app/settings";
  return "/app";
}

/**
 * Public marketing entry. Signed-in users go straight into the app
 * (Settings when they have no marks and no Cursor provider yet).
 *
 * @returns The landing page for guests, or a redirect into the app.
 */
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect(await appEntryFor(session.user.id));
  return <Landing />;
}
