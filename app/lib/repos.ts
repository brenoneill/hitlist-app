import type { Repository } from "@/app/lib/cursor";

/**
 * Reads repository URLs configured via environment variables.
 * Prefers `CURSOR_REPOS` (comma-separated) and falls back to `CURSOR_REPO_URL`.
 * @returns Deduplicated repository entries from env configuration.
 */
export function reposFromEnv(): Repository[] {
  const multi = process.env.CURSOR_REPOS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const single = process.env.CURSOR_REPO_URL?.trim();
  const urls = [
    ...(multi ?? []),
    ...(single ? [single] : []),
  ];
  return [...new Set(urls)].map((url) => ({ url }));
}

/**
 * Short display name for a GitHub repository URL (owner/name).
 * @param url - Full repository URL or bare path.
 * @returns A compact label suitable for tight mobile UI.
 */
export function repoLabel(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\/|\/$/g, "");
    return path || url;
  } catch {
    return url.replace(/^https?:\/\/(www\.)?github\.com\//, "");
  }
}
