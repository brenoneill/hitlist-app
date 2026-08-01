"use client";

import { Icon } from "@/app/components/Icons";
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
    <div
      role="radiogroup"
      aria-label="Agent provider"
      className={`flex gap-2 ${className}`.trim()}
    >
      {providers.map((p) => {
        const selected = value === p;
        const meta = PROVIDER_META[p];
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={meta.label}
            onClick={() => onChange(p)}
            className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:border-info ${
              selected
                ? "border-info bg-info/10 text-foreground"
                : "border-edge bg-background text-muted hover:text-foreground"
            }`}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                selected
                  ? "border-info/40 bg-info/15 text-foreground"
                  : "border-edge bg-surface text-muted"
              }`}
            >
              <Icon name={meta.icon} className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {p === "copilot" ? "Copilot" : meta.label}
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
