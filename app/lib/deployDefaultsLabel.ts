import type { IconName } from "@/app/components/Icons";
import {
  VISUAL_CONFIRMATION_OPTIONS,
  type VisualConfirmationId,
} from "@/app/lib/prOptions";
import { PROVIDER_META, type ProviderId } from "@/app/lib/providerMeta";

const VISUAL_ICONS: Record<VisualConfirmationId, IconName> = {
  "image-video": "film",
  image: "image",
  none: "ban",
};

export type DeployDefaultsChip = {
  icon: IconName;
  label: string;
};

/**
 * Short labeled chips for a deploy-defaults summary (sheet / settings).
 * @param provider - Selected provider, if any.
 * @param modelId - Selected model id, or empty/null for Auto.
 * @param modelName - Display name when known from the models list.
 * @param visualConfirmation - Selected visual confirmation mode.
 * @returns Ordered chips with icon + label.
 */
export function deployDefaultsChips({
  provider,
  modelId,
  modelName,
  visualConfirmation,
  showProvider,
}: {
  provider: ProviderId | undefined;
  modelId: string | null | undefined;
  modelName?: string;
  visualConfirmation: VisualConfirmationId;
  showProvider: boolean;
}): DeployDefaultsChip[] {
  const chips: DeployDefaultsChip[] = [];
  if (showProvider && provider) {
    chips.push({
      icon: PROVIDER_META[provider].icon,
      label:
        provider === "copilot" ? "Copilot" : PROVIDER_META[provider].label,
    });
  }
  chips.push({
    icon: "settings",
    label: modelId ? (modelName ?? modelId) : "Auto",
  });
  const visual =
    VISUAL_CONFIRMATION_OPTIONS.find((o) => o.id === visualConfirmation)
      ?.label ?? visualConfirmation;
  chips.push({
    icon: VISUAL_ICONS[visualConfirmation],
    label: visual === "None" ? "No proof" : visual,
  });
  return chips;
}
