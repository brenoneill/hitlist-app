import { auth } from "@/auth";
import { getCursorApiKey, setCursorApiKey } from "@/app/lib/userSettings";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "sign in required" }, { status: 401 });
  }
  const key = await getCursorApiKey(session.user.id);
  return Response.json({ hasKey: !!key });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "sign in required" }, { status: 401 });
  }
  const { key } = (await req.json()) as { key?: string };
  if (typeof key !== "string" || !key.trim()) {
    return Response.json({ error: "key required" }, { status: 400 });
  }
  await setCursorApiKey(session.user.id, key.trim());
  return Response.json({ hasKey: true });
}
