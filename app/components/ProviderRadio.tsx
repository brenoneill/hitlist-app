"use client";

import { RadioCardGroup } from "@/app/components/ui/RadioCardGroup";
import {
  PROVIDER_META,
  type ProviderId,
} from "@/app/lib/providerMeta";

/**
 * Equal-width provider radiogroup (Cursor / Copilot icon cards).
 * @param providers - Configured providers to offer.
 * @param value - Currently selected provider.
 * @param onChange - Called when the user picks a different provider.
 * @param className - Optional layout classes on the radiogroup.
 */
export function ProviderRadio({
  providers,
  value,
  onChange,
  className = "",
}: {
  providers: readonly ProviderId[];
  value: ProviderId | undefined;
  onChange: (next: ProviderId) => void;
  className?: string;
}) {
  if (providers.length < 2) return null;
  return (
    <RadioCardGroup
      ariaLabel="Agent provider"
      value={value}
      onChange={onChange}
      className={className}
      options={providers.map((p) => {
        const meta = PROVIDER_META[p];
        return {
          id: p,
          label: p === "copilot" ? "Copilot" : meta.label,
          icon: meta.icon,
          ariaLabel: meta.label,
        };
      })}
    />
  );
}
