"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon } from "@/app/components/Icons";

/**
 * Shared top bar: optional back link + title (defaults to the HITLIST
 * wordmark linking home) + optional settings/avatar link.
 *
 * @param backHref - When set, shows a chevron back control to this path.
 * @param title - Page title; omit to show the HITLIST wordmark (links to `/app`).
 * @param hideSettingsLink - Hide the settings/avatar affordance (e.g. on settings).
 */
export function AppHeader({
  backHref,
  title,
  hideSettingsLink,
}: {
  backHref?: string;
  title?: string;
  hideSettingsLink?: boolean;
}) {
  const { data: session } = useSession();

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back to hitlist"
            className="flex size-10 items-center justify-center rounded-xl border border-edge bg-surface text-muted transition-colors active:bg-background"
          >
            <Icon name="chevron" className="size-4 rotate-90" />
          </Link>
        )}
        {title ? (
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        ) : (
          <h1 className="text-2xl font-bold tracking-tight">
            <Link
              href="/app"
              className="flex items-center gap-2"
              aria-label="HITLIST home"
            >
              <Icon name="crosshair" className="size-6 text-blood" />
              HITLIST
            </Link>
          </h1>
        )}
      </div>
      {!hideSettingsLink && (
        <Link
          href="/app/settings"
          aria-label="Settings"
          className={
            session?.user?.image
              ? "flex size-10 items-center justify-center"
              : "flex size-10 items-center justify-center rounded-xl border border-edge bg-surface text-muted transition-colors active:bg-background"
          }
        >
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- external GitHub avatar; no images.remotePatterns configured
            <img
              src={session.user.image}
              alt=""
              className="size-10 rounded-full"
            />
          ) : (
            <Icon name="settings" className="size-4" />
          )}
        </Link>
      )}
    </div>
  );
}
