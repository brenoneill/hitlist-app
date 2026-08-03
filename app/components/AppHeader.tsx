"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon } from "@/app/components/Icons";

/**
 * Shared top bar: back link + title (defaults to the HITLIST wordmark) +
 * optional settings/avatar link.
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
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Icon name="crosshair" className="size-6 text-blood" />
            HITLIST
          </h1>
        )}
      </div>
      {!hideSettingsLink && (
        <Link
          href="/app/settings"
          aria-label="Settings"
          className="flex size-10 items-center justify-center rounded-xl border border-edge bg-surface text-muted transition-colors active:bg-background"
        >
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- external GitHub avatar; no images.remotePatterns configured
            <img
              src={session.user.image}
              alt=""
              className="size-7 rounded-full"
            />
          ) : (
            <Icon name="settings" className="size-4" />
          )}
        </Link>
      )}
    </div>
  );
}
