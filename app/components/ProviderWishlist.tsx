"use client";

import { useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import { Chip } from "@/app/components/ui/Chip";
import { FieldLabel } from "@/app/components/ui/FieldLabel";

/**
 * Providers HitList can't dispatch to yet. Wishes land in Vercel Analytics as
 * `provider_wish` / `provider_unwish` events — the dashboard breakdown is the tally.
 *
 * Shipping one: add it to PROVIDER_META + providers.ts, then drop it here.
 */
const WISHLIST = [
  "GitHub Copilot",
  "Claude Code",
  "OpenAI Codex",
  "Devin",
  "Google Jules",
  "Amp",
  "Replit Agent",
  "Factory Droid",
] as const;

// ponytail: localStorage, so a wish follows the browser not the person.
// Move to a table if you ever want to show real counts back to users.
const STORAGE_KEY = "providerWishes";

type WishlistFrom = "landing" | "settings" | "onboarding";

/**
 * Lets visitors vote on which agent provider to support next. Wishes persist
 * per browser; tapping a wished chip unselects it.
 *
 * @param compact - Settings-tab scale (matches the surrounding step blocks)
 *   instead of the landing page's marketing spacing.
 * @param from - Analytics source; defaults from `compact` (`settings` /
 *   `landing`). Pass `onboarding` for the Connect Cursor wizard step.
 */
export function ProviderWishlist({
  compact = false,
  from,
}: {
  compact?: boolean;
  from?: WishlistFrom;
}) {
  const [wished, setWished] = useState<string[]>([]);
  const source: WishlistFrom = from ?? (compact ? "settings" : "landing");
  const onboarding = source === "onboarding";
  const tight = compact || onboarding;

  // Read after mount — localStorage during render mismatches the SSR markup.
  useEffect(() => {
    setWished(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  }, []);

  /**
   * Toggles a provider wish on or off, persists to localStorage, and emits
   * a `provider_wish` / `provider_unwish` analytics event.
   *
   * @param provider - Wishlist provider label to select or unselect.
   */
  function toggleWish(provider: string) {
    if (wished.includes(provider)) {
      const next = wished.filter((p) => p !== provider);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setWished(next);
      track("provider_unwish", { provider, from: source });
      return;
    }
    const next = [...wished, provider];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setWished(next);
    // `from` separates idle landing curiosity from signed-in users who hit
    // the wall in settings / onboarding — those are the stronger build signals.
    track("provider_wish", { provider, from: source });
  }

  return (
    <section
      className={
        tight
          ? "mb-6 border-t border-edge pt-4"
          : "border-t border-edge/80 pt-12 mt-16"
      }
    >
      <FieldLabel className={tight ? "mb-2" : "mb-2 mt-6 first:mt-0"}>
        {onboarding ? "Feedback" : "Coming next"}
      </FieldLabel>
      {tight ? (
        <h3 className="text-sm font-semibold tracking-tight">
          {onboarding
            ? "Use another agent? Let us know."
            : "Which agent should we add?"}
        </h3>
      ) : (
        <h2 className="text-2xl font-bold tracking-tight">
          Which agent should we add?
        </h2>
      )}
      <p
        className={`text-sm leading-relaxed text-muted ${tight ? "mt-1" : "mt-2 max-w-lg"}`}
      >
        {onboarding
          ? "HitList dispatches to Cursor today. Tap any others you want — the most-wished provider gets built first."
          : "HitList dispatches to Cursor today. Tap the ones you want next - the most-wished provider gets built first."}
      </p>
      <ul className={`flex flex-wrap gap-2 ${tight ? "mt-3" : "mt-6"}`}>
        {WISHLIST.map((provider) => {
          const sent = wished.includes(provider);
          return (
            <li key={provider}>
              <Chip
                variant={sent ? "info" : "muted"}
                icon={sent ? "check" : undefined}
                onClick={() => toggleWish(provider)}
                aria-pressed={sent}
                aria-label={
                  sent
                    ? `Unselect wish for ${provider}`
                    : `Wish for ${provider}`
                }
              >
                {provider}
                {sent && <span className="sr-only"> — wish sent</span>}
              </Chip>
            </li>
          );
        })}
      </ul>
      <p
        aria-live="polite"
        className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted"
      >
        {wished.length > 0
          ? `${wished.length} wish${wished.length > 1 ? "es" : ""} sent — thank you`
          : " "}
      </p>
    </section>
  );
}
