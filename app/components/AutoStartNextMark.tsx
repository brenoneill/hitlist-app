/**
 * Presentational checkbox for auto-dispatching the next Mark (or group)
 * after a merge. Used live in the merge confirm dialog and as a demo on
 * the landing page — callers own preference persistence and next-target
 * resolution.
 *
 * @param checked - Whether auto-start is on.
 * @param nextLabel - Title of the next Mark/group that would dispatch.
 * @param isGroup - When true, label says "group" instead of "Mark".
 * @param onChange - Called with the new checked state when the user toggles.
 * @param className - Optional classes on the outer label (defaults include
 *   bottom margin for the merge dialog).
 */
export function AutoStartNextMark({
  checked,
  nextLabel,
  isGroup = false,
  onChange,
  className = "mb-3",
}: {
  checked: boolean;
  nextLabel: string;
  isGroup?: boolean;
  onChange: (on: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 text-xs text-muted ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
        className="mt-0.5 size-3.5 shrink-0 accent-blood"
      />
      <span>
        {isGroup ? "Auto-start next group" : "Auto-start next Mark"}
        <span className="mt-0.5 block truncate font-mono text-[11px]">
          {nextLabel}
        </span>
      </span>
    </label>
  );
}
