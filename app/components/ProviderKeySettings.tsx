"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/components/Icons";
import {
  CURSOR_ARTIFACTS_GITHUB_URL,
  CURSOR_ARTIFACTS_TIP_KEY,
  PROVIDER_META,
  type ProviderId,
} from "@/app/lib/providerMeta";
import {
  useClearProviderKey,
  useProviderKeys,
  useSaveProviderKey,
} from "@/app/lib/queries";

/**
 * Provider row card: icon + name + connection state, expanding to the key
 * form on tap. Collapses itself once a key saves.
 */
export function ProviderKeySettings({ provider }: { provider: ProviderId }) {
  const meta = PROVIDER_META[provider];
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  // null until mounted — avoids flashing the tip after a prior dismiss
  const [artifactsTipDone, setArtifactsTipDone] = useState<boolean | null>(
    null,
  );
  const { data, isPending: loading } = useProviderKeys();
  const save = useSaveProviderKey();
  const clear = useClearProviderKey();
  const hasKey = data?.[provider] ?? false;
  const busy = loading || save.isPending || clear.isPending;
  const canSave = key.trim().length > 0;
  const showArtifactsTip =
    provider === "cursor" && hasKey && artifactsTipDone === false;

  useEffect(() => {
    if (provider !== "cursor") return;
    setArtifactsTipDone(
      localStorage.getItem(CURSOR_ARTIFACTS_TIP_KEY) === "1",
    );
  }, [provider]);

  function ackArtifactsTip() {
    localStorage.setItem(CURSOR_ARTIFACTS_TIP_KEY, "1");
    setArtifactsTipDone(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    save.mutate(
      { provider, key: key.trim() },
      {
        onSuccess: () => {
          setKey("");
          setOpen(false);
        },
      },
    );
  }

  return (
    <div
      className={`mb-2 rounded-xl border border-edge bg-surface ${
        open ? "overflow-visible" : "overflow-hidden"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-background"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-edge bg-background">
          <Icon name={meta.icon} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{meta.label}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            {hasKey ? (
              <>
                <span className="size-1.5 rounded-full bg-ok" />
                Connected
              </>
            ) : (
              meta.blurb
            )}
          </span>
        </span>
        <Icon
          name="chevron"
          className={`size-4 shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-edge px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted">
              {hasKey ? "Key saved — paste a new one to replace it" : "Paste your key"}
            </span>
            <a
              href={meta.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted underline underline-offset-4"
            >
              Get a key ↗
            </a>
          </div>
          <form onSubmit={submit} className="flex items-stretch gap-2">
            <div className="relative min-w-0 flex-1">
              <Icon
                name="key"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              />
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={busy}
                placeholder={meta.placeholder}
                className="h-full w-full rounded-xl border border-edge bg-background py-3 pl-9 pr-4 text-base outline-none placeholder:text-muted focus:border-blood disabled:opacity-50"
              />
            </div>
            {canSave && (
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center rounded-xl border border-edge px-4 text-base font-medium active:bg-background disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save"}
              </button>
            )}
            {hasKey && (
              <div className="relative flex">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label={`${meta.label} key actions`}
                  aria-expanded={menuOpen}
                  className="inline-flex items-center rounded-xl border border-edge px-3 text-muted active:bg-background disabled:opacity-50"
                >
                  <Icon name="ellipsis" className="size-4" />
                </button>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-1 min-w-36 overflow-hidden rounded-xl border border-edge bg-surface shadow-lg shadow-black/50">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          clear.mutate(provider, {
                            onSuccess: () => {
                              setKey("");
                              setMenuOpen(false);
                            },
                          })
                        }
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-blood hover:bg-background disabled:opacity-50"
                      >
                        <Icon name="trash" className="size-4" />
                        Delete key
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </form>
        </div>
      )}

      {showArtifactsTip && (
        <div className="border-t border-edge px-4 py-3">
          <p className="text-xs text-muted">
            Turn on{" "}
            <span className="text-foreground">
              Allow posting artifacts to GitHub
            </span>{" "}
            so screenshots show up inline in PRs.{" "}
            <a
              href={CURSOR_ARTIFACTS_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Open Cursor settings ↗
            </a>
          </p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={false}
              onChange={ackArtifactsTip}
              className="size-3.5 shrink-0 accent-blood"
            />
            I&apos;ve turned this on
          </label>
        </div>
      )}
    </div>
  );
}
