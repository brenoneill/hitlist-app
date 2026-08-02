import type { NextRequest } from "next/server";
import { requireUserId } from "@/auth";
import { deleteImages } from "@/app/lib/catbox";
import { getTask, removeTask, updateTask, type TaskStatus } from "@/app/lib/tasks";

const STATUSES: TaskStatus[] = ["inbox", "running", "done", "failed"];

/**
 * Updates a task by id. Accepts a JSON body with optional `status`, `details`,
 * `title`, `repoUrl`, and `imageUrls` fields (details/title are trimmed; empty
 * details clears it; empty title is rejected; null/empty repoUrl clears the
 * tag; imageUrls must be catbox/legacy temp-host URLs, empty array clears them).
 * @param req - Incoming request with a JSON patch body.
 * @param ctx - Route context containing the task `id` param.
 * @returns The updated task, or 400/404 on failure.
 */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/tasks/[id]">,
) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { status, details, title, repoUrl, imageUrls } = body as {
    status?: unknown;
    details?: unknown;
    title?: unknown;
    repoUrl?: unknown;
    imageUrls?: unknown;
  };

  if (status !== undefined && !STATUSES.includes(status as TaskStatus)) {
    return Response.json({ error: "invalid status" }, { status: 400 });
  }
  if (details !== undefined && typeof details !== "string") {
    return Response.json({ error: "invalid details" }, { status: 400 });
  }
  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return Response.json({ error: "invalid title" }, { status: 400 });
    }
  }
  if (
    repoUrl !== undefined &&
    repoUrl !== null &&
    typeof repoUrl !== "string"
  ) {
    return Response.json({ error: "invalid repoUrl" }, { status: 400 });
  }
  // host-pinned to the upload route's hosts (+ legacy litterbox/uguu rows):
  // these URLs are pasted verbatim into the agent prompt
  const allowedImageUrl = (u: unknown) => {
    if (typeof u !== "string") return false;
    try {
      const { protocol, hostname } = new URL(u);
      return (
        protocol === "https:" &&
        (hostname === "files.catbox.moe" ||
          hostname === "litter.catbox.moe" ||
          hostname.endsWith(".uguu.se"))
      );
    } catch {
      return false;
    }
  };
  if (
    imageUrls !== undefined &&
    (!Array.isArray(imageUrls) || !imageUrls.every(allowedImageUrl))
  ) {
    return Response.json({ error: "invalid imageUrls" }, { status: 400 });
  }

  if (imageUrls !== undefined) {
    const existing = await getTask(userId, id);
    if (!existing) {
      return Response.json({ error: "task not found" }, { status: 404 });
    }
    const next = imageUrls as string[];
    const removed = (existing.imageUrls ?? []).filter((u) => !next.includes(u));
    await deleteImages(removed);
  }

  const updated = await updateTask(userId, id, {
    ...(status !== undefined ? { status: status as TaskStatus } : {}),
    ...(details !== undefined ? { details: details.trim() || undefined } : {}),
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(repoUrl !== undefined
      ? {
          repoUrl:
            typeof repoUrl === "string" && repoUrl.trim()
              ? repoUrl.trim()
              : undefined,
        }
      : {}),
    ...(imageUrls !== undefined
      ? { imageUrls: (imageUrls as string[]).length ? (imageUrls as string[]) : undefined }
      : {}),
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
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const { id } = await ctx.params;
  const existing = await getTask(userId, id);
  await deleteImages(existing?.imageUrls);
  await removeTask(userId, id);
  return new Response(null, { status: 204 });
}
