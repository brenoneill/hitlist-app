import {
  VISUAL_CONFIRMATION_OPTIONS,
  type VisualConfirmationId,
} from "@/app/lib/prOptions";
import { PROVIDER_META, type ProviderId } from "@/app/lib/providerMeta";

/**
 * Short labels for a deploy-defaults summary (sheet collapsed row / settings).
 * @param provider - Selected provider, if any.
 * @param modelId - Selected model id, or empty/null for Auto.
 * @param modelName - Display name when known from the models list.
 * @param visualConfirmation - Selected visual confirmation mode.
 * @returns Ordered chip labels for the summary row.
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
}): string[] {
  const chips: string[] = [];
  if (showProvider && provider) {
    chips.push(
      provider === "copilot" ? "Copilot" : PROVIDER_META[provider].label,
    );
  }
  chips.push(
    modelId
      ? (modelName ?? modelId)
      : "Auto",
  );
  const visual =
    VISUAL_CONFIRMATION_OPTIONS.find((o) => o.id === visualConfirmation)
      ?.label ?? visualConfirmation;
  chips.push(visual === "None" ? "No proof" : visual);
  return chips;
}
