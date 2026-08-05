"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/app/components/Button";
import { Icon } from "@/app/components/Icons";
import { ProviderKeySettings } from "@/app/components/ProviderKeySettings";
import {
  ConnectReposCard,
  DefaultOptionsForm,
} from "@/app/components/GithubRepos";
import { useProviderKeys, useRepos } from "@/app/lib/queries";
import { usePwaInstall } from "@/app/lib/usePwaInstall";
import {
  CURSOR_INTEGRATIONS_URL,
  OFFERED_PROVIDER_IDS,
} from "@/app/lib/providerMeta";

/** absent = never seen · "active" = mid-flow (survives the GitHub redirect) · "done" = finished or skipped */
const STORAGE_KEY = "hitlist:onboarding";

/**
 * First-run full-screen setup flow over the settings page. Shows once for
 * users with incomplete setup, resumes at the right step after the GitHub
 * App install round-trip, and never returns after Skip or Done.
 */
export function OnboardingWizard() {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const { data: keys, isLoading: keysLoading } = useProviderKeys(signedIn);
  const { data: github, isLoading: reposLoading } = useRepos(signedIn);
  const [dismissed, setDismissed] = useState(false);

  // Decide only after the queries settle — same gate as the settings
  // skeleton, so the wizard never flashes over painted settings. Also means
  // this only runs client-side, so localStorage is safe to read in render.
  if (!signedIn || keysLoading || reposLoading || dismissed) return null;

  const hasAnyKey = OFFERED_PROVIDER_IDS.some((p) => keys?.[p]);
  const connected = github?.connected ?? false;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "done") return null;
  // Already configured and never mid-flow → an existing user; skip silently.
  if (stored !== "active" && hasAnyKey && connected) return null;

  return (
    <Wizard
      hasAnyKey={hasAnyKey}
      connected={connected}
      repoCount={github?.repos.length ?? 0}
      onClose={() => {
        localStorage.setItem(STORAGE_KEY, "done");
        setDismissed(true);
      }}
    />
  );
}

const STEPS = 4;

function Wizard({
  hasAnyKey,
  connected,
  repoCount,
  onClose,
}: {
  hasAnyKey: boolean;
  connected: boolean;
  repoCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  // Resume where setup left off — a full page load (e.g. returning from the
  // GitHub install) re-infers instead of persisting the step.
  const [step, setStep] = useState(() => (!hasAnyKey ? 1 : !connected ? 2 : 3));
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { deferredPrompt, standalone, ios, ready, promptInstall } =
    usePwaInstall();

  // Auto-advance once the key saves — no Next press needed. Render-time
  // adjustment so going Back to step 1 with a saved key doesn't bounce.
  const [prevHasKey, setPrevHasKey] = useState(hasAnyKey);
  if (hasAnyKey !== prevHasKey) {
    setPrevHasKey(hasAnyKey);
    if (hasAnyKey && step === 1) setStep(2);
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, "active");
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
  }, [step]);

  const nextBlocked = (step === 1 && !hasAnyKey) || (step === 2 && !connected);

  // Fade out before unmounting/navigating instead of snapping straight back
  // to settings — 280ms matches --animate-fade-out.
  function close(after: () => void) {
    setClosing(true);
    setTimeout(after, 280);
  }

  function finish() {
    // Decide the landing spot before the fade starts. Fully set up → kick
    // off the route change immediately, fading out over it, instead of
    // waiting out the fade to reveal settings and jumping away a beat
    // later. Still mid-setup → nothing to navigate to, so let the fade
    // finish revealing settings underneath, same as Skip.
    if (hasAnyKey && connected) {
      // Don't call onClose() here — it flips the parent's dismissed state
      // in the same commit as setClosing, which unmounts this div before
      // the fade ever paints. Just latch "done" and let router.push's own
      // unmount (settings page going away) remove the wizard once the
      // fade's had time to play.
      localStorage.setItem(STORAGE_KEY, "done");
      setClosing(true);
      router.push("/app");
    } else {
      close(onClose);
    }
  }

  return (
    // ponytail: aria-modal + initial focus is the ceiling — add a real focus
    // trap if an a11y audit asks for one
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Set up HitList"
      tabIndex={-1}
      className={`fixed inset-0 z-50 overflow-y-auto bg-background outline-none ${
        closing ? "animate-fade-out" : ""
      }`}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mb-8 flex items-center justify-between">
          <p className="flex items-center gap-2">
            <span className="sr-only">{`Step ${step} of ${STEPS}`}</span>
            {Array.from({ length: STEPS }, (_, i) => (
              <span
                key={i}
                aria-hidden
                className={`size-1.5 rounded-full ${
                  i + 1 === step
                    ? "bg-blood"
                    : i + 1 < step
                      ? "bg-ok"
                      : "bg-edge"
                }`}
              />
            ))}
          </p>
          <Button variant="ghost" onClick={finish} className="text-xs">
            Skip for now
          </Button>
        </div>

        <div key={step} className="flex-1 animate-fade-in">
          {step === 1 && (
            <>
              <h1 className="mb-2 text-2xl font-semibold">Connect Cursor</h1>
              <p className="mb-6 text-sm text-muted">
                HitList dispatches Cursor&apos;s cloud agents to work through
                your list. Your API key lets it start those runs for you —
                it&apos;s stored encrypted, and you can create one in the
                Cursor dashboard with the link below.
              </p>
              <ProviderKeySettings provider="cursor" defaultOpen />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="mb-2 text-2xl font-semibold">
                Connect your repos
              </h1>
              <p className="mb-6 text-sm text-muted">
                Pick the GitHub repos your agents will work on.
              </p>
              {connected ? (
                <>
                  <p className="mb-3 flex items-center gap-1.5 text-sm text-ok">
                    <Icon name="check" className="size-4 shrink-0" />
                    {repoCount === 1
                      ? "1 repo connected"
                      : `${repoCount} repos connected`}
                  </p>
                  <p className="text-sm text-muted">
                    Make sure the same repos are granted under{" "}
                    <a
                      href={CURSOR_INTEGRATIONS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      Cursor → Integrations → GitHub
                    </a>{" "}
                    — without that, agents can&apos;t clone or open PRs.
                  </p>
                </>
              ) : (
                <ConnectReposCard />
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="mb-2 text-2xl font-semibold">
                Pick your defaults
              </h1>
              <p className="mb-6 text-sm text-muted">
                Almost done — how should runs go out?
              </p>
              <DefaultOptionsForm />
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="mb-2 text-2xl font-semibold">Install the app</h1>
              <p className="mb-6 text-sm text-muted">
                Install HitList for full access to the app and all of its
                features.
              </p>
              {!ready ? null : standalone ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Icon name="check" className="size-3.5 shrink-0 text-ok" />
                  HitList is installed on this device.
                </p>
              ) : deferredPrompt ? (
                <Button
                  onClick={() => void promptInstall().then(finish)}
                  className="flex w-full items-center justify-center gap-2"
                >
                  <Icon name="download" className="size-4" />
                  Install HitList
                </Button>
              ) : ios ? (
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
                  <li>
                    Tap <span className="text-foreground">Share</span> in
                    Safari
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
                <p className="text-sm text-muted">
                  Open your browser menu and look for{" "}
                  <span className="text-foreground">Install</span> or{" "}
                  <span className="text-foreground">Add to Home Screen</span>.
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-8 flex items-center gap-4">
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              className="text-sm"
            >
              Back
            </Button>
          )}
          {step < STEPS ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={nextBlocked}
              className="flex-1"
            >
              Next
            </Button>
          ) : standalone ? (
            <Button onClick={finish} className="flex-1">
              Done
            </Button>
          ) : (
            <Button variant="outline" onClick={finish} className="flex-1">
              Not right now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
