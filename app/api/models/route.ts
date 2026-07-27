import { requireUserId } from "@/auth";
import { listModels } from "@/app/lib/cursor";
import { getCursorApiKey } from "@/app/lib/userSettings";

export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const cursorApiKey = await getCursorApiKey(userId);
  if (!cursorApiKey) {
    return Response.json(
      { error: "add your Cursor API key in Settings first" },
      { status: 400 },
    );
  }
  try {
    return Response.json(await listModels(cursorApiKey));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
