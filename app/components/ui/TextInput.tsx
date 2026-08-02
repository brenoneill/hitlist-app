import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { fieldClass, type FieldTone } from "@/app/components/ui/fieldClasses";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  tone?: FieldTone;
  startAdornment?: ReactNode;
};

/**
 * Styled text/password input with shared field chrome.
 * @param tone - `background` or `surface` fill.
 * @param startAdornment - Optional leading icon (adds left padding).
 * @param className - Extra classes on the input.
 */
export const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput(
  { tone = "background", startAdornment, className = "", ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      {...props}
      className={fieldClass(
        tone,
        [
          startAdornment ? "py-3 pl-9 pr-4" : "px-4 py-3",
          "w-full text-base",
          className,
        ]
          .filter(Boolean)
          .join(" "),
      )}
    />
  );

  if (!startAdornment) return input;

  return (
    <div className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
        {startAdornment}
      </span>
      {input}
    </div>
  );
});
