"use client";

import type { Task, TaskStatus } from "@/app/lib/tasks";
import { Icon, type IconName } from "@/app/components/Icons";

const STATUS_DISPLAY: Record<
  TaskStatus,
  { label: string; cls: string; icon: IconName }
> = {
  inbox: { label: "MARKED", cls: "text-muted", icon: "crosshair" },
  running: {
    label: "AGENT DEPLOYED",
    cls: "text-warn animate-pulse",
    icon: "crosshair",
  },
  done: { label: "EXECUTED", cls: "text-ok", icon: "check" },
  failed: { label: "BOTCHED", cls: "text-blood", icon: "x" },
};

/** A dispatched agent outlives the done toggle — status alone forgets it. */
export const wasDeployed = (t: Task) => !!t.agentUrl;
export const deployable = (t: Task) => t.status === "inbox" && !wasDeployed(t);
/** Already has an agent — can start a fresh one via Redeploy. */
export const redeployable = (t: Task) => wasDeployed(t);
/** Work in progress: an agent is out (or its PR still landing) and it isn't archived. */
export const inFlight = (t: Task) =>
  t.status !== "done" && (t.status === "running" || wasDeployed(t));

/** Merged PRs get GitHub's merge glyph; anything still open keeps the PR one. */
export const prIcon = (t: Task): IconName =>
  t.prState === "merged" ? "merge" : "pr";

/** A merged PR's link is green; an open one is blue. */
export function prLinkClass(task: Task): string {
  return task.mergedAt ? "text-ok" : "text-info";
}

/** Status refined by what the run reported: merged, PR waiting, agent mid-work. */
function statusDisplay(t: Task): { label: string; cls: string; icon: IconName } {
  if (t.prState === "merged") {
    return { label: "MERGED", cls: "text-ok", icon: "merge" };
  }
  if (t.prState === "closed") {
    return { label: "PR CLOSED", cls: "text-muted", icon: "x" };
  }
  if (t.status === "done") {
    return STATUS_DISPLAY.done;
  }
  if (t.prUrl && t.status !== "running" && t.status !== "failed") {
    return { label: "PR READY", cls: "text-info", icon: "pr" };
  }
  if (t.status === "inbox" && wasDeployed(t)) {
    return { ...STATUS_DISPLAY.running, cls: "text-muted" };
  }
  if (t.status === "running" && t.runStatus === "RUNNING") {
    return {
      label: "AGENT WORKING",
      cls: "text-warn animate-pulse",
      icon: "crosshair",
    };
  }
  return STATUS_DISPLAY[t.status];
}

export function StatusBadge({ task }: { task: Task }) {
  const s = statusDisplay(task);
  return (
    <span
      className={`flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest ${s.cls}`}
    >
      <Icon name={s.icon} className="size-3" />
      {s.label}
    </span>
  );
}

function prLabel(task: Task): string | null {
  if (!task.prUrl) return null;
  if (task.status === "running") return "DRAFT";
  if (task.prState === "merged") return "MERGED";
  return "PR";
}

/**
 * PR / agent affordances beside a hit. `live` uses real anchors; `inert`
 * keeps the same chrome without navigation (landing preview).
 */
export function TaskItemLinks({
  task,
  mode = "live",
  prClassName,
}: {
  task: Task;
  mode?: "live" | "inert";
  prClassName: string;
}) {
  const label = prLabel(task);
  if (!label && !(mode === "live" && task.agentUrl)) return null;

  if (mode === "inert") {
    if (!label) return null;
    return (
      <span
        className={`flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-widest ${prClassName}`}
      >
        <Icon name={prIcon(task)} className="size-3.5" />
        {label}
      </span>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {label && task.prUrl && (
        <a
          href={task.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-widest active:opacity-70 ${prClassName}`}
        >
          <Icon name={prIcon(task)} className="size-3.5" />
          {label}
        </a>
      )}
      {task.agentUrl && (
        <a
          href={task.agentUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-muted active:text-blood"
        >
          <span className="sr-only">View agent</span>
          <Icon name="external" className="size-3.5" />
        </a>
      )}
    </div>
  );
}

/**
 * Shared hit-row body used by the app list and the landing preview.
 *
 * @param task - Hit to render
 * @param links - `live` for real PR/agent anchors; `inert` for display-only chrome
 * @param onSelect - Optional tap handler (app sheet open); omit on static previews
 * @param className - Classes for the outer content wrapper
 */
export function TaskItem({
  task,
  links = "live",
  onSelect,
  className = "flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left",
}: {
  task: Task;
  links?: "live" | "inert";
  onSelect?: (t: Task) => void;
  className?: string;
}) {
  const showStatus = task.status !== "inbox" || wasDeployed(task);
  const showLinks =
    !!task.prUrl || (links === "live" && !!task.agentUrl);
  const body = (
    <>
      <span
        className={`w-full break-words ${
          task.status === "done"
            ? "text-muted line-through decoration-blood/70"
            : ""
        }`}
      >
        {task.title}
      </span>
      {task.repoUrl && (
        <span className="text-xs text-muted">
          --{task.repoUrl.split("/").pop()}
        </span>
      )}
      {(showStatus || showLinks || task.agentSummary) && (
        <div className="flex w-full items-end justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
            {showStatus && <StatusBadge task={task} />}
            {task.agentSummary && (
              <span className="w-full truncate text-xs text-muted">
                {task.agentSummary}
              </span>
            )}
          </div>
          <TaskItemLinks
            task={task}
            mode={links}
            prClassName={prLinkClass(task)}
          />
        </div>
      )}
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(task)} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

/**
 * Card shell matching list rows — border/surface used by landing preview and
 * as the ActionRow className source of truth in the app list.
 */
export function taskItemShellClass(opts?: {
  highlight?: boolean;
  denied?: boolean;
}): string {
  return [
    "rounded-xl border border-edge bg-surface transition-transform",
    opts?.highlight ? "scale-[1.02] ring-2 ring-blood" : "",
    opts?.denied ? "animate-pulse ring-2 ring-blood/50" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
