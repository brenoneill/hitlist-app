import { listRepositories } from "@/app/lib/cursor";
import { reposFromEnv } from "@/app/lib/repos";

/**
 * Returns repositories available for agent dispatch.
 * Merges Cursor API results with env-configured fallbacks when the API is unavailable.
 * @returns JSON `{ items: { url: string }[] }`.
 */
export async function GET() {
  const fromEnv = reposFromEnv();

  try {
    const fromApi = await listRepositories();
    const seen = new Set<string>();
    const items = [...fromApi, ...fromEnv].filter(({ url }) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
    return Response.json({ items });
  } catch {
    return Response.json({ items: fromEnv });
  }
}
