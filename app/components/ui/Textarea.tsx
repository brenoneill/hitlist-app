import type { TextareaHTMLAttributes } from "react";
import { fieldClass, type FieldTone } from "@/app/components/ui/fieldClasses";

export type TextareaVariant = "default" | "mono" | "ghost" | "pill";

const VARIANT: Record<TextareaVariant, string> = {
  default:
    "field-sizing-content min-h-[5.5rem] w-full resize-none overflow-hidden px-4 py-3 text-base leading-normal",
  mono: "w-full resize-none p-3 font-mono text-xs",
  // single-line chat composer that grows with content, capped before it takes over the screen
  pill:
    "field-sizing-content min-h-0 max-h-32 w-full resize-none overflow-y-auto rounded-full px-4 py-2.5 text-base leading-normal",
  ghost:
    "field-sizing-content w-full resize-none overflow-hidden break-words rounded-xl border border-transparent bg-transparent px-0 py-0 text-lg font-medium outline-none focus:border-edge focus:bg-background focus:px-3 focus:py-2",
};

/**
 * Styled textarea with shared field chrome.
 * @param variant - `default` form field, `mono` code/playbook, or `ghost` title.
 * @param tone - Fill token (ignored for `ghost`).
 * @param className - Extra layout classes.
 */
export function Textarea({
  variant = "default",
  tone = "background",
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  variant?: TextareaVariant;
  tone?: FieldTone;
}) {
  if (variant === "ghost") {
    return (
      <textarea
        {...props}
        className={[VARIANT.ghost, className].filter(Boolean).join(" ")}
      />
    );
  }

  return (
    <textarea
      {...props}
      className={fieldClass(
        tone,
        [VARIANT[variant], className].filter(Boolean).join(" "),
      )}
    />
  );
}
