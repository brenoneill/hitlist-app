"use client";

import { RadioCardGroup } from "@/app/components/ui/RadioCardGroup";
import { type IconName } from "@/app/components/Icons";
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
 * Flex row (same card chrome as Cursor / Copilot); icon-only below `lg`
 * with sr-only labels, text shown on large screens.
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
    <RadioCardGroup
      ariaLabel="Visual confirmation"
      value={value}
      onChange={onChange}
      className={className}
      compactLabel
      options={VISUAL_CONFIRMATION_OPTIONS.map((o) => ({
        id: o.id,
        label: o.id === "none" ? "None required" : o.label,
        icon: ICONS[o.id],
      }))}
    />
  );
}
