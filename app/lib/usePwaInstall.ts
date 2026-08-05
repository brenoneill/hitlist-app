"use client";

import { useEffect, useState } from "react";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Whether the app is already running as an installed PWA (standalone display
 * mode, or iOS Safari's `navigator.standalone` flag).
 */
export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Rough iOS Safari detection — used for the manual Share → Add to Home Screen
 * path, since iOS never fires `beforeinstallprompt`.
 */
export function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Shared PWA install state for the bottom banner and Settings section.
 * Stashes Chromium's `beforeinstallprompt` event and reports standalone / iOS.
 *
 * @returns Install capability flags and a `promptInstall` trigger for Chromium.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIosDevice());
    setReady(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /**
   * Shows the browser install UI when a deferred prompt is available.
   * No-op on iOS / browsers that never fired `beforeinstallprompt`.
   */
  async function promptInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return { deferredPrompt, standalone, ios, ready, promptInstall };
}
