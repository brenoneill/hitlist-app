"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/components/Icons";

export function CursorKeySettings() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/cursor-key")
      .then((res) => res.json())
      .then((body) => setHasKey(body.hasKey));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setSaving(true);
    await fetch("/api/settings/cursor-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim() }),
    });
    setSaving(false);
    setKey("");
    setHasKey(true);
  }

  if (hasKey === null) return null;

  return (
    <form onSubmit={save} className="mb-6 flex gap-2">
      <div className="relative min-w-0 flex-1">
        <Icon
          name="key"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={
            hasKey ? "Cursor key saved — replace it…" : "Your Cursor API key…"
          }
          className="w-full rounded-xl border border-edge bg-surface py-3 pl-9 pr-4 text-base outline-none placeholder:text-muted focus:border-blood"
        />
      </div>
      <button
        type="submit"
        disabled={saving || !key.trim()}
        className="rounded-xl border border-edge px-5 py-3 text-base font-medium active:bg-surface disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
