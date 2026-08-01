"use client";

import { Icon, type IconName } from "@/app/components/Icons";
import {
  VISUAL_CONFIRMATION_OPTIONS,
  type VisualConfirmationId,
} from "@/app/lib/prOptions";

const ICONS: Record<VisualConfirmationId, IconName> = {
  "image-video": "film",
  image: "image",
  none: "ban",
};

/**
 * Shared radiogroup for visual confirmation (image & video / image / none).
 * Icon-only flex row (same card chrome as Cursor / Copilot); labels are
 * sr-only. Used in deploy action sheets and Settings.
 * @param value - Currently selected mode.
 * @param onChange - Called when the user picks a different mode.
 * @param className - Optional layout classes on the radiogroup.
 */
export function VisualConfirmationRadio({
  value,
  onChange,
  className = "",
}: {
  value: VisualConfirmationId;
  onChange: (next: VisualConfirmationId) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Visual confirmation"
      className={`flex gap-2 ${className}`.trim()}
    >
      {VISUAL_CONFIRMATION_OPTIONS.map((o) => {
        const selected = value === o.id;
        const label = o.id === "none" ? "None required" : o.label;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors outline-none focus-visible:border-info ${
              selected
                ? "border-info bg-info/10 text-foreground"
                : "border-edge bg-background text-muted hover:text-foreground"
            }`}
          >
            <span className="sr-only">{label}</span>
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                selected
                  ? "border-info/40 bg-info/15 text-foreground"
                  : "border-edge bg-surface text-muted"
              }`}
            >
              <Icon name={ICONS[o.id]} className="size-4" />
            </span>
            <span
              aria-hidden
              className={`size-3.5 shrink-0 rounded-full border-2 ${
                selected
                  ? "border-info bg-info shadow-[0_0_8px_rgba(59,130,246,0.45)]"
                  : "border-edge bg-transparent"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
