"use client";

import { useState } from "react";
import { useCursorKey, useSaveCursorKey } from "@/app/lib/queries";
import { Icon } from "@/app/components/Icons";

export function CursorKeySettings() {
  const [key, setKey] = useState("");
  const { data, isPending: loading } = useCursorKey();
  const save = useSaveCursorKey();
  const hasKey = data?.hasKey ?? false;

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
          disabled={loading}
          placeholder={
            hasKey ? "Cursor key saved — replace it…" : "Your Cursor API key…"
          }
          className="w-full rounded-xl border border-edge bg-surface py-3 pl-9 pr-4 text-base outline-none placeholder:text-muted focus:border-blood disabled:opacity-50"
        />
      </div>
      <button
        type="submit"
        disabled={loading || save.isPending || !key.trim()}
        className="rounded-xl border border-edge px-5 py-3 text-base font-medium active:bg-surface disabled:opacity-50"
      >
        {save.isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
