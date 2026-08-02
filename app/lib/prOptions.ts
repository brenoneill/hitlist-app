/**
 * Per-dispatch visual-confirmation requirements. Toggled in the deploy sheet
 * (and defaulted from user settings); joined into the agent prompt. Pure data:
 * imported by client components, so nothing server-only may creep in.
 */
import type { ProviderId } from "./providerMeta";

const LOGIN =
  "- Login screens: use Repo access notes / Context / AGENTS.md; else say what you couldn't capture. Don't forge sessions.";

function screenshotCriteria(provider: ProviderId): string {
  if (provider === "copilot") {
    return `## Acceptance criteria (required)
- Capture screenshots proving each change works.
- If \`hitlist-apps/\` already exists, delete it first (leftover from a prior PR) so only this run's files are committed.
- Commit screenshots under \`hitlist-apps/\` (no capture scripts). Embed in the PR description:
  \`![desc](hitlist-apps/<name>.png)\`
${LOGIN}`;
  }
  return `## Acceptance criteria (required)
- Capture screenshots proving each change works.
- Save under \`/opt/cursor/artifacts/\` (do not commit). Embed in the PR description via ManagePullRequest:
  \`<img src="/opt/cursor/artifacts/<name>.png" alt="desc">\`
${LOGIN}`;
}

function imageAndVideoCriteria(provider: ProviderId): string {
  const video =
    provider === "copilot"
      ? `## Visual confirmation — video (required)
- Also record a short MP4/WebM walkthrough. Commit under \`hitlist-apps/\` and link it in the PR description. If recording is blocked, say so and still ship screenshots.`
      : `## Visual confirmation — video (required)
- Also record a short MP4/WebM walkthrough. Save under \`/opt/cursor/artifacts/\` and embed via ManagePullRequest:
  \`<recording_ref src="/opt/cursor/artifacts/<name>.mp4">desc</recording_ref>\`
- If recording is blocked, say so and still ship screenshots.`;
  return `${screenshotCriteria(provider)}\n\n${video}`;
}

function noneCriteria(_provider: ProviderId): string {
  return `## Visual confirmation
- None required. Do **not** capture screenshots or recordings, run demo/e2e just for PR proof, or create \`hitlist-apps/\` / Cursor artifacts.`;
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
    prompt: noneCriteria,
  },
] as const;

export type VisualConfirmationId =
  (typeof VISUAL_CONFIRMATION_OPTIONS)[number]["id"];

/** Built-in fallback when the user has never chosen a default. */
export const DEFAULT_VISUAL_CONFIRMATION: VisualConfirmationId = "image";

/** Dispatch body still uses an options id array; ids match VisualConfirmationId. */
export type PrOptionId = VisualConfirmationId;

/** Ids that add a positive visual-proof section (excludes `none`). */
export const PR_OPTIONS = VISUAL_CONFIRMATION_OPTIONS.filter(
  (o) => o.id !== "none",
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
 * Prompt sections for the selected mode and agent provider.
 * @param ids - Option ids from the dispatch body (empty = none required).
 * @param provider - Agent provider; selects Cursor artifacts vs Copilot `hitlist-apps/` embeds.
 * @returns One acceptance-criteria / visual-confirmation section.
 */
export function optionSections(
  ids: readonly string[],
  provider: ProviderId,
): string[] {
  const mode = resolveVisualConfirmation(ids);
  const opt = VISUAL_CONFIRMATION_OPTIONS.find((o) => o.id === mode);
  return opt ? [opt.prompt(provider)] : [];
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
