const API = "https://catbox.moe/user/api.php";
const HOST = "files.catbox.moe";

function userhash(): string | undefined {
  return process.env.CATBOX_USERHASH?.trim() || undefined;
}

/** True when CATBOX_USERHASH is set (uploads require it; deletes no-op without it). */
export function catboxConfigured(): boolean {
  return !!userhash();
}

function catboxFilename(url: string): string | undefined {
  try {
    const { protocol, hostname, pathname } = new URL(url);
    if (protocol !== "https:" || hostname !== HOST) return undefined;
    const name = pathname.replace(/^\//, "");
    return name && !name.includes("/") && !name.includes(" ") ? name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Uploads an image to catbox.moe under the shared account userhash.
 * @param file - Image file to host publicly.
 * @returns Public `https://files.catbox.moe/...` URL.
 * @throws If CATBOX_USERHASH is unset or the API rejects the upload.
 */
export async function uploadImage(file: File): Promise<string> {
  const hash = userhash();
  if (!hash) throw new Error("CATBOX_USERHASH is not set");

  const fd = new FormData();
  fd.set("reqtype", "fileupload");
  fd.set("userhash", hash);
  fd.set("fileToUpload", file);

  const res = await fetch(API, { method: "POST", body: fd });
  const text = (await res.text()).trim();
  if (res.ok && text.startsWith(`https://${HOST}/`)) return text;

  throw new Error(
    `catbox.moe ${res.status}: ${text
      .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
      .replace(/<[^>]*>/g, "")
      .slice(0, 80)}`,
  );
}

/**
 * Best-effort delete of catbox-hosted URLs. No-ops without a userhash or
 * when none of the URLs are on files.catbox.moe. Never throws.
 * @param urls - Public URLs previously returned by uploadImage.
 */
export async function deleteImages(
  urls: readonly string[] | undefined,
): Promise<void> {
  const hash = userhash();
  if (!hash || !urls?.length) return;

  const files = urls
    .map(catboxFilename)
    .filter((n): n is string => !!n);
  if (!files.length) return;

  try {
    const fd = new FormData();
    fd.set("reqtype", "deletefiles");
    fd.set("userhash", hash);
    fd.set("files", files.join(" "));
    await fetch(API, { method: "POST", body: fd });
  } catch {
    // best-effort — merge/delete must not fail because catbox is down
  }
}
