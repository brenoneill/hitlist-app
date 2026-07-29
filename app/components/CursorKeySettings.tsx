"use client";

import { useEffect, useState } from "react";
import {
  useClearCursorKey,
  useCursorKey,
  useSaveCursorKey,
} from "@/app/lib/queries";
import { Icon } from "@/app/components/Icons";

export function CursorKeySettings() {
  const [key, setKey] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastSavedKey, setLastSavedKey] = useState("");
  const { data, isPending: loading } = useCursorKey();
  const save = useSaveCursorKey();
  const clear = useClearCursorKey();
  const hasKey = data?.hasKey ?? false;
  const busy = loading || clear.isPending;

  useEffect(() => {
    const trimmed = key.trim();
    if (!trimmed || trimmed === lastSavedKey) return;
    const timer = window.setTimeout(() => {
      save.mutate(trimmed, { onSuccess: () => setLastSavedKey(trimmed) });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [key, lastSavedKey, save]);

  return (
    <div className="mb-6 flex gap-2">
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
          placeholder={
            hasKey ? "Cursor key saved — replace it…" : "Your Cursor API key…"
          }
          className="w-full rounded-xl border border-edge bg-surface py-3 pl-9 pr-4 text-base outline-none placeholder:text-muted focus:border-blood disabled:opacity-50"
        />
      </div>
      {hasKey && (
        <div className="relative">
          <button
            type="button"
            disabled={busy}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Cursor key actions"
            className="rounded-xl border border-edge px-3 py-3 text-muted active:bg-surface disabled:opacity-50"
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
                    clear.mutate(undefined, {
                      onSuccess: () => {
                        setKey("");
                        setLastSavedKey("");
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
    </div>
  );
}
