import { requireUserId } from "@/auth";
import { PROVIDER_IDS, type ProviderId } from "@/app/lib/providerMeta";
import { clearProviderKey, setProviderKey } from "@/app/lib/userSettings";

function parseProvider(value: string): ProviderId | undefined {
  return PROVIDER_IDS.find((p) => p === value);
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/settings/keys/[provider]">,
) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const provider = parseProvider((await ctx.params).provider);
  if (!provider) {
    return Response.json({ error: "unknown provider" }, { status: 400 });
  }
  const { key } = (await req.json().catch(() => ({}))) as { key?: string };
  if (typeof key !== "string" || !key.trim()) {
    return Response.json({ error: "key required" }, { status: 400 });
  }
  await setProviderKey(userId, provider, key.trim());
  return Response.json({ hasKey: true });
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/settings/keys/[provider]">,
) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const provider = parseProvider((await ctx.params).provider);
  if (!provider) {
    return Response.json({ error: "unknown provider" }, { status: 400 });
  }
  await clearProviderKey(userId, provider);
  return Response.json({ hasKey: false });
}
