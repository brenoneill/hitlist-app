"use client";

import type { CursorModel } from "@/app/lib/cursor";

/**
 * Agent model `<select>` with an Auto option and reserved height while loading.
 * @param value - Selected model id, or empty for Auto.
 * @param onChange - Called with the next model id (empty = Auto).
 * @param models - Available models for the current provider.
 * @param loading - True while the models list is fetching.
 * @param className - Optional layout classes on the select.
 * @param disabled - Extra disable flag (e.g. no provider yet).
 */
export function ModelSelect({
  value,
  onChange,
  models,
  loading,
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  models: CursorModel[] | undefined;
  loading: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-label="Agent model"
      className={`h-[2.875rem] w-full rounded-xl border border-edge bg-background px-4 text-base outline-none focus:border-blood disabled:opacity-70 ${className}`.trim()}
    >
      <option value="">
        {!loading ? "Auto (default model)" : "Loading models…"}
      </option>
      {value && !(models ?? []).some((m) => m.id === value) && (
        <option value={value}>{value}</option>
      )}
      {(models ?? []).map((m) => (
        <option key={m.id} value={m.id}>
          {m.displayName}
        </option>
      ))}
    </select>
  );
}
