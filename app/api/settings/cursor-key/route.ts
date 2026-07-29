import { requireUserId } from "@/auth";
import {
  clearCursorApiKey,
  getCursorApiKey,
  setCursorApiKey,
} from "@/app/lib/userSettings";

export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const key = await getCursorApiKey(userId);
  return Response.json({ hasKey: !!key });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const { key } = (await req.json().catch(() => ({}))) as { key?: string };
  if (typeof key !== "string" || !key.trim()) {
    return Response.json({ error: "key required" }, { status: 400 });
  }
  await setCursorApiKey(userId, key.trim());
  return Response.json({ hasKey: true });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  await clearCursorApiKey(userId);
  return Response.json({ hasKey: false });
}
