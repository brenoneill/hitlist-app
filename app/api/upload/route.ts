import { requireUserId } from "@/auth";

const MAX_BYTES = 10 * 1024 * 1024;

/** POSTs `fd` and returns the validated public URL, or throws a short error. */
async function post(
  endpoint: string,
  fd: FormData,
  extract: (body: string) => string | undefined,
): Promise<string> {
  const res = await fetch(endpoint, { method: "POST", body: fd });
  const text = (await res.text()).trim();
  const url = res.ok ? extract(text) : undefined;
  if (!url) {
    // bodies can be full HTML error pages — keep the message short
    throw new Error(
      `${new URL(endpoint).host} ${res.status}: ${text
        .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
        .replace(/<[^>]*>/g, "")
        .slice(0, 80)}`,
    );
  }
  return url;
}

async function litterbox(file: File): Promise<string> {
  const fd = new FormData();
  fd.set("reqtype", "fileupload");
  fd.set("time", "72h");
  fd.set("fileToUpload", file);
  return post(
    "https://litterbox.catbox.moe/resources/internals/api.php",
    fd,
    (t) => (t.startsWith("https://litter.catbox.moe/") ? t : undefined),
  );
}

async function uguu(file: File): Promise<string> {
  const fd = new FormData();
  fd.set("files[]", file);
  return post("https://uguu.se/upload", fd, (t) => {
    const url = JSON.parse(t).files?.[0]?.url as string | undefined;
    return url && new URL(url).hostname.endsWith(".uguu.se") ? url : undefined;
  });
}

/**
 * Proxies a screenshot upload to a public temp host — the browser can't POST
 * to them directly reliably (CORS). Tries litterbox.catbox.moe (72h expiry)
 * first, falling back to uguu.se (~3h expiry) when litterbox is down.
 * Accepts multipart form data with an image `file`; returns `{ url }`.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return Response.json({ error: "expected an image file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "image too large (10MB max)" }, { status: 400 });
  }

  // ponytail: uguu keeps files only ~3h — a task that sits before deploy can lose
  // its image; drop the fallback once litterbox is reliable again.
  try {
    return Response.json({ url: await litterbox(file) });
  } catch (litterboxError) {
    try {
      return Response.json({ url: await uguu(file) });
    } catch (uguuError) {
      return Response.json(
        { error: `upload failed — ${litterboxError instanceof Error ? litterboxError.message : litterboxError}; ${uguuError instanceof Error ? uguuError.message : uguuError}` },
        { status: 502 },
      );
    }
  }
}
