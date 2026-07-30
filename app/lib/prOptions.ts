/**
 * Per-dispatch PR requirements, toggled in the deploy sheet and joined into the
 * agent prompt. A new use case is ONE entry here — the dispatch route and the
 * sheet both map over this array. Pure data: imported by a client component, so
 * nothing server-only may creep in.
 */

/** repoUrl is a `https://github.com/{owner}/{repo}` URL. */
function screenshotCriteria(repoUrl: string): string {
  return `## Acceptance criteria (required)
- Run the app and capture screenshots proving each change works as described.
- Save them to a temp directory outside the repo — do **not** commit screenshots or screenshot-capture scripts to the branch.
- Embed them inline in the PR description using **publicly fetchable** image URLs (HTTP 200 with \`Content-Type: image/*\` and **no auth**). Private-repo GitHub raw links do **not** work in PR markdown — GitHub's image proxy fetches them unauthenticated and they 404 (this includes \`raw.githubusercontent.com\`, \`${repoUrl}/raw/...\`, and agent-tool artifact/attachment URLs).
- After uploading, verify each embed URL with an unauthenticated \`curl -sI\` (expect 200 + image content-type) before opening/updating the PR. Do not ship broken image placeholders.
- Preferred flow: upload each to expiring public hosting with \`curl -sF reqtype=fileupload -F time=72h -F 'fileToUpload=@/tmp/<name>.png' https://litterbox.catbox.moe/resources/internals/api.php\` (the response body is the public URL, e.g. \`https://litter.catbox.moe/xxxxx.png\`), and embed with \`![desc](https://litter.catbox.moe/…)\`. Mention in the PR that the images expire after 72h.
- If a screen is behind a login: check the Context section for test credentials or a dev auth-bypass; otherwise capture what you can (login page, unauthenticated states) and state plainly in the PR what could not be captured and why. Never fake or skip silently.`;
}

export const PR_OPTIONS = [
  {
    id: "screenshots",
    label: "Require inline PR screenshots as proof",
    on: true,
    prompt: screenshotCriteria,
  },
] as const;

export type PrOptionId = (typeof PR_OPTIONS)[number]["id"];

/** Ticked when the sheet opens; also the server's fallback for a body with no `options`. */
export const DEFAULT_PR_OPTIONS: PrOptionId[] = PR_OPTIONS.filter(
  (o) => o.on,
).map((o) => o.id);

/** Prompt sections for the selected ids, in registry order; unknown ids ignored. */
export function optionSections(
  ids: readonly string[],
  repoUrl: string,
): string[] {
  return PR_OPTIONS.filter((o) => ids.includes(o.id)).map((o) =>
    o.prompt(repoUrl),
  );
}
