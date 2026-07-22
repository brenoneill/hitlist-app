"use client";

import { useEffect, useState } from "react";

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
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={
          hasKey ? "Cursor key saved — replace it…" : "Your Cursor API key…"
        }
        className="flex-1 rounded-xl border border-black/10 bg-transparent px-4 py-3 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      <button
        type="submit"
        disabled={saving || !key.trim()}
        className="rounded-xl border border-black/10 px-5 py-3 text-base font-medium disabled:opacity-50 dark:border-white/15"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
