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

/**
 * Lets visitors vote on which agent provider to support next. Wishes persist
 * per browser; tapping a wished chip unselects it.
 *
 * @param compact - Settings-tab scale (matches the surrounding step blocks)
 *   instead of the landing page's marketing spacing.
 */
export function ProviderWishlist({ compact = false }: { compact?: boolean }) {
  const [wished, setWished] = useState<string[]>([]);

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
    const from = compact ? "settings" : "landing";
    if (wished.includes(provider)) {
      const next = wished.filter((p) => p !== provider);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setWished(next);
      track("provider_unwish", { provider, from });
      return;
    }
    const next = [...wished, provider];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setWished(next);
    // `from` separates idle landing curiosity from signed-in users who hit
    // the wall in settings — the second is the stronger build signal.
    track("provider_wish", { provider, from });
  }

  return (
    <section
      className={
        compact
          ? "mb-6 border-t border-edge pt-4"
          : "border-t border-edge/80 pt-12 mt-16"
      }
    >
      <FieldLabel className={compact ? "mb-2" : "mb-2 mt-6 first:mt-0"}>
        Coming next
      </FieldLabel>
      {compact ? (
        <h3 className="text-sm font-semibold tracking-tight">
          Which agent should we add?
        </h3>
      ) : (
        <h2 className="text-2xl font-bold tracking-tight">
          Which agent should we add?
        </h2>
      )}
      <p
        className={`text-sm leading-relaxed text-muted ${compact ? "mt-1" : "mt-2 max-w-lg"}`}
      >
        HitList dispatches to Cursor and GitHub Copilot today. Tap the ones you
        want next — the most-wished provider gets built first.
      </p>
      <ul className={`flex flex-wrap gap-2 ${compact ? "mt-3" : "mt-6"}`}>
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
