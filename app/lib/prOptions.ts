/**
 * Per-dispatch visual-confirmation requirements. Toggled in the deploy sheet
 * (and defaulted from user settings); joined into the agent prompt. Pure data:
 * imported by client components, so nothing server-only may creep in.
 */

/** repoUrl is a `https://github.com/{owner}/{repo}` URL. */
function screenshotCriteria(repoUrl: string): string {
  return `## Acceptance criteria (required)
- Run the app and capture screenshots proving each change works as described.
- Save them to a temp directory outside the repo — do **not** commit screenshots or screenshot-capture scripts to the branch.
- Embed them inline in the PR description using **publicly fetchable** image URLs (HTTP 200 with \`Content-Type: image/*\` and **no auth**). Private-repo GitHub raw links do **not** work in PR markdown — GitHub's image proxy fetches them unauthenticated and they 404 (this includes \`raw.githubusercontent.com\`, \`${repoUrl}/raw/...\`, and agent-tool artifact/attachment URLs).
- After uploading, verify each embed URL with an unauthenticated \`curl -sI\` (expect 200 + image content-type) before opening/updating the PR. Do not ship broken image placeholders.
- Preferred flow: upload each to expiring public hosting with \`curl -sF reqtype=fileupload -F time=72h -F 'fileToUpload=@/tmp/<name>.png' https://litterbox.catbox.moe/resources/internals/api.php\` (the response body is the public URL, e.g. \`https://litter.catbox.moe/xxxxx.png\`), and embed with \`![desc](https://litter.catbox.moe/…)\`. Mention in the PR that the images expire after 72h.
- If a screen is behind a login: check the "Repo access notes" section of this prompt, the Context section, and the repo's agent docs (AGENTS.md / CLAUDE.md) for test credentials or a documented dev auth-bypass; otherwise capture what you can (login page, unauthenticated states) and state plainly in the PR what could not be captured and why. Never fake or skip silently — do not forge sessions or stub out auth.`;
}

/** Image proof plus a short screen recording of the flow. */
function imageAndVideoCriteria(repoUrl: string): string {
  return `${screenshotCriteria(repoUrl)}

## Visual confirmation — video (required)
- Also capture a short screen recording (MP4/WebM) that walks through the change working end-to-end.
- Save the video outside the repo — do **not** commit recordings or capture scripts to the branch.
- Upload to the same expiring public host (\`curl -sF reqtype=fileupload -F time=72h -F 'fileToUpload=@/tmp/<name>.mp4' https://litterbox.catbox.moe/resources/internals/api.php\`) and embed a **publicly fetchable** link in the PR (HTTP 200, video or binary content-type, no auth). Mention that media expires after 72h.
- If recording is blocked in the environment, say so plainly in the PR and still ship the required screenshots.`;
}

export const VISUAL_CONFIRMATION_OPTIONS = [
  {
    id: "image-video",
    label: "Image & video",
    prompt: imageAndVideoCriteria,
  },
  {
    id: "image",
    label: "Image",
    prompt: screenshotCriteria,
  },
  {
    id: "none",
    label: "None",
    prompt: null,
  },
] as const;

export type VisualConfirmationId =
  (typeof VISUAL_CONFIRMATION_OPTIONS)[number]["id"];

/** Built-in fallback when the user has never chosen a default. */
export const DEFAULT_VISUAL_CONFIRMATION: VisualConfirmationId = "image";

/** Dispatch body still uses an options id array; ids match VisualConfirmationId. */
export type PrOptionId = VisualConfirmationId;

/** Ids that add a prompt section (excludes `none`). */
export const PR_OPTIONS = VISUAL_CONFIRMATION_OPTIONS.filter(
  (o): o is (typeof VISUAL_CONFIRMATION_OPTIONS)[number] & {
    prompt: (repoUrl: string) => string;
  } => o.prompt !== null,
);

/** Server fallback when the dispatch body omits `options` and no user default. */
export const DEFAULT_PR_OPTIONS: PrOptionId[] = [DEFAULT_VISUAL_CONFIRMATION];

/**
 * Resolves a dispatch `options` array to a single visual confirmation mode.
 * @param ids - Option ids from the dispatch body; `undefined` means use fallback.
 * @param fallback - Mode when ids is omitted (user default or built-in).
 * @returns The selected visual confirmation mode.
 */
export function resolveVisualConfirmation(
  ids: readonly string[] | undefined,
  fallback: VisualConfirmationId = DEFAULT_VISUAL_CONFIRMATION,
): VisualConfirmationId {
  if (ids === undefined) return fallback;
  if (ids.length === 0) return "none";
  const hit = VISUAL_CONFIRMATION_OPTIONS.find((o) => ids.includes(o.id));
  return hit?.id ?? fallback;
}

/**
 * Prompt sections for the selected mode.
 * @param ids - Option ids from the dispatch body (empty = none required).
 * @param repoUrl - Repo URL interpolated into the criteria text.
 * @returns Zero or one acceptance-criteria section strings.
 */
export function optionSections(
  ids: readonly string[],
  repoUrl: string,
): string[] {
  const mode = resolveVisualConfirmation(ids);
  const opt = VISUAL_CONFIRMATION_OPTIONS.find((o) => o.id === mode);
  if (!opt?.prompt) return [];
  return [opt.prompt(repoUrl)];
}

/**
 * Packs a mode into the dispatch `options` array shape.
 * @param mode - Selected visual confirmation mode.
 * @returns Empty array for `none`, otherwise a single-id array.
 */
export function optionsForMode(mode: VisualConfirmationId): PrOptionId[] {
  return mode === "none" ? [] : [mode];
}

/**
 * True when the string is a known visual confirmation id.
 * @param value - Candidate id from storage or a request body.
 */
export function isVisualConfirmationId(
  value: string,
): value is VisualConfirmationId {
  return VISUAL_CONFIRMATION_OPTIONS.some((o) => o.id === value);
}
