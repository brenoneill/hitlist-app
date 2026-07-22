import type { NextRequest } from "next/server";
import { removeTask } from "@/app/lib/tasks";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/tasks/[id]">,
) {
  const { id } = await ctx.params;
  await removeTask(id);
  return new Response(null, { status: 204 });
}
