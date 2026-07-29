import { requireUserId } from "@/auth";
import { getProviderKeyFlags } from "@/app/lib/userSettings";

export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  return Response.json(await getProviderKeyFlags(userId));
}
