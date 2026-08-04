import { requireUserId } from "@/auth";
import { OFFERED_PROVIDER_IDS, PROVIDER_META } from "@/app/lib/providerMeta";
import { PROVIDERS } from "@/app/lib/providers";
import { getProviderKey } from "@/app/lib/userSettings";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const requested = new URL(req.url).searchParams.get("provider") ?? "cursor";
  const provider = OFFERED_PROVIDER_IDS.find((p) => p === requested);
  if (!provider) {
    return Response.json({ error: "unknown provider" }, { status: 400 });
  }
  const apiKey = await getProviderKey(userId, provider);
  if (!apiKey) {
    return Response.json(
      { error: `add your ${PROVIDER_META[provider].label} key in Settings first` },
      { status: 400 },
    );
  }
  try {
    return Response.json(await PROVIDERS[provider].listModels(apiKey));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
