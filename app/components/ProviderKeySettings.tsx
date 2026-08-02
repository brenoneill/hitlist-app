"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/components/Icons";
import {
  PROVIDER_META,
  PROVIDER_TIPS,
  type ProviderId,
} from "@/app/lib/providerMeta";
import {
  useClearProviderKey,
  useProviderKeys,
  useSaveProviderKey,
} from "@/app/lib/queries";
import { Menu, MenuItem } from "@/app/components/ui/Menu";
import { TextInput } from "@/app/components/ui/TextInput";

/**
 * Provider row card: icon + name + connection state, expanding to the key
 * form on tap. Collapses itself once a key saves.
 */
export function ProviderKeySettings({ provider }: { provider: ProviderId }) {
  const meta = PROVIDER_META[provider];
  const tip = PROVIDER_TIPS[provider];
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  // null until mounted — avoids flashing the tip after a prior dismiss
  const [tipDone, setTipDone] = useState<boolean | null>(null);
  const { data, isPending: loading } = useProviderKeys();
  const save = useSaveProviderKey();
  const clear = useClearProviderKey();
  const hasKey = data?.[provider] ?? false;
  const busy = loading || save.isPending || clear.isPending;
  const canSave = key.trim().length > 0;
  const showTip = !!tip && hasKey && tipDone === false;
  const showCopilotHint = provider === "copilot" && hasKey;

  useEffect(() => {
    if (!tip) return;
    setTipDone(localStorage.getItem(tip.storageKey) === "1");
  }, [tip]);

  function ackTip() {
    if (!tip) return;
    localStorage.setItem(tip.storageKey, "1");
    setTipDone(true);
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
            <TextInput
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={busy}
              placeholder={meta.placeholder}
              className="h-full"
              startAdornment={
                <Icon name="key" className="size-4 text-muted" aria-hidden />
              }
            />
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
                <Menu
                  open={menuOpen}
                  onClose={() => setMenuOpen(false)}
                  className="right-0 top-full mt-1 min-w-36"
                >
                  <MenuItem
                    icon="trash"
                    destructive
                    disabled={busy}
                    onClick={() =>
                      clear.mutate(provider, {
                        onSuccess: () => {
                          setKey("");
                          setMenuOpen(false);
                        },
                      })
                    }
                  >
                    Delete key
                  </MenuItem>
                </Menu>
              </div>
            )}
          </form>
        </div>
      )}

      {showTip && tip && (
        <div className="border-t border-edge px-4 py-3">
          <p className="text-xs text-muted">
            {tip.before}{" "}
            <span className="text-foreground">{tip.highlight}</span> {tip.after}{" "}
            <a
              href={tip.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              {tip.linkLabel}
            </a>
          </p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={false}
              onChange={ackTip}
              className="size-3.5 shrink-0 accent-blood"
            />
            I&apos;ve turned this on
          </label>
        </div>
      )}

      {showCopilotHint && (
        <div className="border-t border-edge px-4 py-3">
          <p className="text-xs text-muted">
            For screenshots, open a connected repo below and add{" "}
            <span className="text-foreground">
              files.catbox.moe
            </span>{" "}
            to that repo&apos;s Copilot allowlist.
          </p>
        </div>
      )}
    </div>
  );
}
