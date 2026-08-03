"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon } from "@/app/components/Icons";

/** Shared top bar: HITLIST title (with optional back link) + settings/avatar. */
export function AppHeader({ backHref }: { backHref?: string }) {
  const { data: session } = useSession();

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back to hitlist"
            className="-ml-1 p-1 text-muted active:text-foreground"
          >
            <Icon name="chevron" className="size-5 rotate-90" />
          </Link>
        )}
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Icon name="crosshair" className="size-6 text-blood" />
          HITLIST
        </h1>
      </div>
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
    </div>
  );
}
