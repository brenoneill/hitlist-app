import { requireUserId } from "@/auth";
import { OFFERED_PROVIDER_IDS, type ProviderId } from "@/app/lib/providerMeta";
import { isVisualConfirmationId } from "@/app/lib/prOptions";
import {
  getDeployDefaults,
  setDeployDefaults,
} from "@/app/lib/userSettings";

/**
 * Returns the signed-in user's deploy defaults.
 * @returns JSON `{ provider, model, visualConfirmation }` or a 401 response.
 */
export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  return Response.json(await getDeployDefaults(userId));
}

/**
 * Updates deploy defaults. Omitted fields are unchanged; `null` clears
 * provider/model back to auto.
 * @param req - JSON body with optional `provider`, `model`, `visualConfirmation`.
 * @returns The full defaults after save, or 400/401.
 */
export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const body = (await req.json().catch(() => ({}))) as {
    provider?: string | null;
    model?: string | null;
    visualConfirmation?: string;
  };

  const patch: {
    provider?: ProviderId | null;
    model?: string | null;
    visualConfirmation?: import("@/app/lib/prOptions").VisualConfirmationId;
  } = {};

  if ("provider" in body) {
    if (body.provider === null || body.provider === "") {
      patch.provider = null;
    } else if (
      typeof body.provider === "string" &&
      OFFERED_PROVIDER_IDS.includes(body.provider as ProviderId)
    ) {
      patch.provider = body.provider as ProviderId;
    } else {
      return Response.json(
        {
          error: `provider must be ${OFFERED_PROVIDER_IDS.join(", ")}, or null`,
        },
        { status: 400 },
      );
    }
  }

  if ("model" in body) {
    if (body.model === null || body.model === "") {
      patch.model = null;
    } else if (typeof body.model === "string") {
      patch.model = body.model.trim() || null;
    } else {
      return Response.json(
        { error: "model must be a string or null" },
        { status: 400 },
      );
    }
  }

  if ("visualConfirmation" in body) {
    if (
      !body.visualConfirmation ||
      !isVisualConfirmationId(body.visualConfirmation)
    ) {
      return Response.json(
        { error: "visualConfirmation must be image-video, image, or none" },
        { status: 400 },
      );
    }
    patch.visualConfirmation = body.visualConfirmation;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json(
      { error: "provide provider, model, and/or visualConfirmation" },
      { status: 400 },
    );
  }

  try {
    return Response.json(await setDeployDefaults(userId, patch));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
