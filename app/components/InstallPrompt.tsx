"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/app/components/Icons";
import { Button } from "@/app/components/Button";
import { usePwaInstall } from "@/app/lib/usePwaInstall";

const DISMISSED_KEY = "hitlist:install-dismissed";

const dismissListeners = new Set<() => void>();

function subscribeDismissed(onStoreChange: () => void) {
  dismissListeners.add(onStoreChange);
  return () => {
    dismissListeners.delete(onStoreChange);
  };
}

function getDismissed() {
  return !!localStorage.getItem(DISMISSED_KEY);
}

/**
 * Bottom banner nudging users onto the home-screen PWA. Only shown on the
 * main list (`/app`) so it doesn't steal scroll on landing, onboarding, or
 * settings. Android/Chrome fire `beforeinstallprompt`, which we stash and
 * trigger from a real button; iOS Safari gets a manual Share → Add to Home
 * Screen hint instead. Dismissal is remembered per device via localStorage;
 * already-installed (standalone) sessions never see it.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const { deferredPrompt, standalone, ios, ready, promptInstall } =
    usePwaInstall();
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    getDismissed,
    () => true,
  );

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    dismissListeners.forEach((listener) => listener());
  };

  const install = async () => {
    await promptInstall();
    dismiss();
  };

  // Keep listening for `beforeinstallprompt` everywhere (hook above), but
  // only paint the banner on the main list — elsewhere it fights scroll.
  if (pathname !== "/app") return null;

  const showIOSHint = ready && ios && !standalone;
  if (dismissed || standalone || (!deferredPrompt && !showIOSHint)) return null;

  return (
    <div className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-xl border border-edge bg-surface px-4 py-3 shadow-lg shadow-black/50">
        <Icon name="download" className="size-4 shrink-0 text-info" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
          {deferredPrompt
            ? "Install HitList for full-screen access"
            : "Add to Home Screen: Share → Add to Home Screen"}
        </p>
        {deferredPrompt && (
          <Button variant="outlineSm" onClick={() => void install()}>
            Install
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="text-muted active:opacity-70"
        >
          <Icon name="x" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
