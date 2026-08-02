"use client";

import { Icon, type IconName } from "@/app/components/Icons";

export type RadioCardOption<T extends string> = {
  id: T;
  label: string;
  icon: IconName;
  /** Overrides `label` for `aria-label` when set. */
  ariaLabel?: string;
};

/**
 * Equal-width card radiogroup with icon tile and selection dot.
 * @param ariaLabel - Accessible name for the radiogroup.
 * @param value - Selected option id.
 * @param onChange - Called when the user picks an option.
 * @param options - Cards to render.
 * @param compactLabel - Icon-centered below `lg`; text label shown from `lg` up.
 * @param className - Layout classes on the radiogroup.
 */
export function RadioCardGroup<T extends string>({
  ariaLabel,
  value,
  onChange,
  options,
  compactLabel = false,
  className = "",
}: {
  ariaLabel: string;
  value: T | undefined;
  onChange: (next: T) => void;
  options: readonly RadioCardOption<T>[];
  compactLabel?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex gap-2 ${className}`.trim()}
    >
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.ariaLabel ?? o.label}
            onClick={() => onChange(o.id)}
            className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors outline-none focus-visible:border-info ${
              compactLabel ? "justify-center lg:justify-start" : "text-left"
            } ${
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
              <Icon name={o.icon} className="size-4" />
            </span>
            {compactLabel ? (
              <>
                <span className="sr-only lg:hidden">{o.label}</span>
                <span
                  aria-hidden
                  className="hidden min-w-0 flex-1 truncate text-sm font-medium lg:inline"
                >
                  {o.label}
                </span>
              </>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {o.label}
              </span>
            )}
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
