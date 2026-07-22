import type { NextRequest } from "next/server";
import { removeTask, updateTask, type TaskStatus } from "@/app/lib/tasks";

const STATUSES: TaskStatus[] = ["inbox", "running", "done", "failed"];

/**
 * Updates a task by id. Accepts a JSON body with an optional `status` field.
 * @param req - Incoming request with a JSON patch body.
 * @param ctx - Route context containing the task `id` param.
 * @returns The updated task, or 400/404 on failure.
 */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/tasks/[id]">,
) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { status } = body as { status?: unknown };

  if (status !== undefined && !STATUSES.includes(status as TaskStatus)) {
    return Response.json({ error: "invalid status" }, { status: 400 });
  }

  const updated = await updateTask(id, {
    ...(status !== undefined ? { status: status as TaskStatus } : {}),
  });
  if (!updated) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }
  return Response.json(updated);
}

/**
 * Deletes a task by id.
 * @param _req - Incoming request (unused).
 * @param ctx - Route context containing the task `id` param.
 * @returns Empty 204 response.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/tasks/[id]">,
) {
  const { id } = await ctx.params;
  await removeTask(id);
  return new Response(null, { status: 204 });
}
