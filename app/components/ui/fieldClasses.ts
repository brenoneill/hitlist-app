/** Shared border/focus chrome for text fields and selects. */
export const FIELD_BASE =
  "rounded-xl border border-edge outline-none placeholder:text-muted focus:border-blood disabled:opacity-50";

export type FieldTone = "background" | "surface";

const TONE: Record<FieldTone, string> = {
  background: "bg-background",
  surface: "bg-surface",
};

/**
 * Compose field chrome classes.
 * @param tone - Background surface token.
 * @param className - Extra layout classes.
 */
export function fieldClass(
  tone: FieldTone = "background",
  className = "",
): string {
  return [FIELD_BASE, TONE[tone], className].filter(Boolean).join(" ");
}
