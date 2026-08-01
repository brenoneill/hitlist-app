import { requireUserId } from "@/auth";
import {
  getVisualConfirmation,
  setVisualConfirmation,
} from "@/app/lib/userSettings";
import { isVisualConfirmationId } from "@/app/lib/prOptions";

/**
 * Returns the signed-in user's default visual confirmation mode.
 * @returns JSON `{ visualConfirmation }` or a 401 response.
 */
export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  return Response.json({
    visualConfirmation: await getVisualConfirmation(userId),
  });
}

/**
 * Updates the signed-in user's default visual confirmation mode.
 * @param req - JSON body with `visualConfirmation`.
 * @returns The saved mode, or 400/401.
 */
export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const body = (await req.json().catch(() => ({}))) as {
    visualConfirmation?: string;
  };
  if (
    !body.visualConfirmation ||
    !isVisualConfirmationId(body.visualConfirmation)
  ) {
    return Response.json(
      { error: "visualConfirmation must be image-video, image, or none" },
      { status: 400 },
    );
  }
  await setVisualConfirmation(userId, body.visualConfirmation);
  return Response.json({ visualConfirmation: body.visualConfirmation });
}
