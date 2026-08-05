"use client";

import { Icon } from "@/app/components/Icons";
import { Button } from "@/app/components/Button";
import { FieldLabel } from "@/app/components/ui/FieldLabel";
import { usePwaInstall } from "@/app/lib/usePwaInstall";

/**
 * Settings section encouraging users to install HitList as a PWA. Always
 * visible (unlike the dismissible bottom banner): Chromium gets an Install
 * button when `beforeinstallprompt` fired; iOS gets Share-sheet steps;
 * already-installed sessions show a short confirmation.
 */
export function AddToHomeScreen() {
  const { deferredPrompt, standalone, ios, ready, promptInstall } =
    usePwaInstall();

  return (
    <section className="mb-6 border-t border-edge pt-4">
      <FieldLabel className="mb-2">App</FieldLabel>
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Icon name="download" className="size-4 shrink-0 text-info" />
        Add to Home Screen
      </h3>
      {!ready ? (
        <p className="mt-1 text-sm text-muted">Checking install status…</p>
      ) : standalone ? (
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          <Icon name="check" className="size-3.5 shrink-0 text-ok" />
          HitList is installed on this device.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Install HitList for full-screen access from your home screen — faster
            than opening the browser each time.
          </p>
          {deferredPrompt ? (
            <Button
              variant="outline"
              onClick={() => void promptInstall()}
              className="mt-3 flex w-full items-center justify-center gap-2 text-sm font-medium normal-case tracking-normal"
            >
              <Icon name="download" className="size-4" />
              Install HitList
            </Button>
          ) : ios ? (
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
              <li>
                Tap <span className="text-foreground">Share</span> in Safari
              </li>
              <li>
                Choose{" "}
                <span className="text-foreground">Add to Home Screen</span>
              </li>
              <li>
                Tap <span className="text-foreground">Add</span>
              </li>
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Open your browser menu and look for{" "}
              <span className="text-foreground">Install</span> or{" "}
              <span className="text-foreground">Add to Home Screen</span>.
            </p>
          )}
        </>
      )}
    </section>
  );
}
