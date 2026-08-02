import { requireUserId } from "@/auth";
import { catboxConfigured, uploadImage } from "@/app/lib/catbox";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Proxies a screenshot upload to catbox.moe (permanent host under the shared
 * account). The browser can't POST there directly reliably (CORS). Accepts
 * multipart form data with an image `file`; returns `{ url }`.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  if (!catboxConfigured()) {
    return Response.json(
      { error: "CATBOX_USERHASH is not set" },
      { status: 503 },
    );
  }

  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return Response.json({ error: "expected an image file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "image too large (10MB max)" }, { status: 400 });
  }

  try {
    return Response.json({ url: await uploadImage(file) });
  } catch (err) {
    return Response.json(
      {
        error: `upload failed — ${err instanceof Error ? err.message : err}`,
      },
      { status: 502 },
    );
  }
}
