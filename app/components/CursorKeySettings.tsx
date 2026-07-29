"use client";

import { useState } from "react";
import {
  useClearCursorKey,
  useCursorKey,
  useSaveCursorKey,
} from "@/app/lib/queries";
import { Icon } from "@/app/components/Icons";

export function CursorKeySettings() {
  const [key, setKey] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const { data, isPending: loading } = useCursorKey();
  const save = useSaveCursorKey();
  const clear = useClearCursorKey();
  const hasKey = data?.hasKey ?? false;
  const busy = loading || save.isPending || clear.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    save.mutate(key.trim(), { onSuccess: () => setKey("") });
  }

  return (
    <form onSubmit={submit} className="mb-6 flex gap-2">
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
            aria-label="More actions"
            className="rounded-xl border border-edge px-3 py-3 text-muted active:bg-surface disabled:opacity-50"
          >
            <Icon name="ellipsis" className="size-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-12 z-20 min-w-40 overflow-hidden rounded-xl border border-edge bg-surface shadow-lg shadow-black/50">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    clear.mutate();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-blood hover:bg-background"
                >
                  <Icon name="trash" className="size-4" />
                  Remove key
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !key.trim()}
        className="rounded-xl border border-edge px-5 py-3 text-base font-medium active:bg-surface disabled:opacity-50"
      >
        {save.isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
