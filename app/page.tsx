import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Landing } from "@/app/components/Landing";

/**
 * Public marketing entry. Signed-in users go straight to the app.
 *
 * @returns The landing page for guests, or a redirect to `/app`.
 */
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/app");
  return <Landing />;
}
