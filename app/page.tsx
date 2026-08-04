import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Landing } from "@/app/components/Landing";
import { getProviderKeyFlags } from "@/app/lib/userSettings";

/**
 * Chooses where a signed-in user should enter the app from `/`.
 * No provider key yet means first-time setup → Settings.
 *
 * @param userId - Stable Auth.js user id
 * @returns `/app/settings` when no provider is connected, otherwise `/app`
 */
async function appEntryFor(userId: string): Promise<"/app" | "/app/settings"> {
  const keys = await getProviderKeyFlags(userId);
  if (!Object.values(keys).some(Boolean)) return "/app/settings";
  return "/app";
}

/**
 * Public marketing entry. Signed-in users go straight into the app
 * (Settings when no agent provider is connected yet).
 *
 * @returns The landing page for guests, or a redirect into the app.
 */
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect(await appEntryFor(session.user.id));
  return <Landing />;
}
