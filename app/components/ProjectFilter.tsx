"use client";

import { useRef, useState } from "react";
import type { Task } from "@/app/lib/tasks";
import { Icon } from "@/app/components/Icons";

export type ProjectOption = {
  url: string;
  name: string;
  count: number;
};

/**
 * Builds the project list for the filter slideout from current hits.
 * Only repos that appear on at least one task are included.
 *
 * @param tasks - All tasks currently loaded for the user.
 * @returns Projects sorted by hit count (desc), then name.
 */
export function projectsWithHits(tasks: Task[]): ProjectOption[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (!t.repoUrl) continue;
    counts.set(t.repoUrl, (counts.get(t.repoUrl) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([url, count]) => ({
      url,
      name: url.split("/").pop() ?? url,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Whether a task should remain visible under the active project filter.
 * Empty selection means show everything. Group members inherit a sibling's repo
 * so a filtered group stays intact.
 *
 * @param task - Candidate row.
 * @param selected - Selected project URLs; empty = no filter.
 * @param tasks - Full task list (for group repo lookup).
 */
export function matchesProjectFilter(
  task: Task,
  selected: ReadonlySet<string>,
  tasks: Task[],
): boolean {
  if (selected.size === 0) return true;
  if (task.repoUrl && selected.has(task.repoUrl)) return true;
  if (!task.groupId) return false;
  const groupRepo = tasks.find(
    (t) => t.groupId === task.groupId && t.repoUrl,
  )?.repoUrl;
  return !!groupRepo && selected.has(groupRepo);
}

/**
 * Icon button that opens the project filter; shows a count badge when active.
 *
 * @param activeCount - Number of selected projects (0 = unfiltered).
 * @param disabled - When there are no projects with hits.
 * @param onClick - Opens the slideout.
 */
export function ProjectFilterButton({
  activeCount,
  disabled,
  onClick,
}: {
  activeCount: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        activeCount > 0
          ? `Filter by project, ${activeCount} selected`
          : "Filter by project"
      }
      className="relative flex size-10 items-center justify-center rounded-xl border border-edge bg-surface text-muted transition-colors active:bg-background disabled:opacity-40"
    >
      <Icon name="filter" className="size-4" />
      {activeCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blood px-1 font-mono text-[10px] font-bold leading-none text-white">
          {activeCount}
        </span>
      )}
    </button>
  );
}

/**
 * Right-edge slideout listing projects that have hits. Tapping toggles
 * selection immediately; empty selection clears the filter.
 *
 * @param projects - Options from `projectsWithHits`.
 * @param selected - Currently selected project URLs.
 * @param onChange - Replaces the selection set.
 * @param onClose - Called after the close animation finishes.
 */
export function ProjectFilterSlideout({
  projects,
  selected,
  onChange,
  onClose,
}: {
  projects: ProjectOption[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);

  function requestClose() {
    if (closing) return;
    const el = panelRef.current;
    if (el) {
      el.style.transition = "transform 0.28s cubic-bezier(0.4, 0, 0.68, 0.28)";
      el.style.transform = "translateX(100%)";
    }
    setClosing(true);
  }

  function onHandlePointerDown(e: React.PointerEvent) {
    if (closing) return;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = panelRef.current;
    if (el) el.style.transition = "none";
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (startX.current == null || closing) return;
    const el = panelRef.current;
    if (el)
      el.style.transform = `translateX(${Math.max(0, e.clientX - startX.current)}px)`;
  }

  function onHandlePointerUp(e: React.PointerEvent) {
    if (startX.current == null || closing) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (dx > 80) {
      requestClose();
      return;
    }
    const el = panelRef.current;
    if (el) {
      el.style.transition = "transform 0.2s ease-out";
      el.style.transform = "";
    }
  }

  function toggle(url: string) {
    const next = new Set(selected);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    onChange(next);
  }

  return (
    <div
      className={`fixed inset-0 z-40 flex justify-end bg-black/60 ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-filter-title"
        className="flex h-full w-[min(20rem,88vw)] animate-slide-in-right flex-col border-l border-edge bg-surface shadow-[-12px_0_40px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={(e) => {
          if (!closing) return;
          if (e.target !== e.currentTarget) return;
          if (e.propertyName !== "transform") return;
          onClose();
        }}
      >
        <div className="flex items-start gap-3 border-b border-edge px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div
            className="mt-1 flex shrink-0 touch-none items-center self-stretch pr-1"
            aria-hidden
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          >
            <div className="h-10 w-1 rounded-full bg-edge" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="project-filter-title"
              className="font-mono text-sm font-bold uppercase tracking-widest"
            >
              Projects
            </h2>
            <p className="mt-1 text-xs text-muted">
              Only repos with hits. Tap to filter the list.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close project filter"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted active:bg-background"
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {projects.map((p, i) => {
            const on = selected.has(p.url);
            return (
              <li
                key={p.url}
                className="animate-fade-in"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <button
                  type="button"
                  onClick={() => toggle(p.url)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                    on ? "bg-info/15" : "active:bg-background"
                  }`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      on
                        ? "border-info bg-info text-white"
                        : "border-edge bg-background text-transparent"
                    }`}
                  >
                    <Icon name="check" className="size-3" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm">
                      {p.name}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
                      {p.count} {p.count === 1 ? "hit" : "hits"}
                    </span>
                  </span>
                  <Icon
                    name="crosshair"
                    className={`size-3.5 shrink-0 ${
                      on ? "text-info" : "text-edge"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2 border-t border-edge px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={() => onChange(new Set())}
            disabled={selected.size === 0}
            className="flex-1 rounded-xl border border-edge py-3 font-mono text-xs font-bold uppercase tracking-widest text-muted active:bg-background disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={requestClose}
            className="flex-1 rounded-xl bg-blood py-3 font-mono text-xs font-bold uppercase tracking-widest text-white shadow-[0_0_16px_rgba(220,38,38,0.35)] active:opacity-80"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
