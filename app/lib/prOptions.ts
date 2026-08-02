/**
 * Per-dispatch visual-confirmation mode. Toggled in the deploy sheet (and
 * defaulted from user settings). Prompt text lives in public/playbook/
 * (base.md + skills/); this module is UI/data only (safe for client imports).
 */

export const VISUAL_CONFIRMATION_OPTIONS = [
  { id: "image-video", label: "Image & video" },
  { id: "image", label: "Image" },
  { id: "none", label: "None" },
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
