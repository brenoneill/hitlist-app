"use client";

import { useId, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, TaskStatus } from "@/app/lib/tasks";
import { normalizeGroups } from "@/app/lib/groups";
import { newId } from "@/app/lib/id";
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
/** Work in progress: an agent is out (or its PR still landing) and it isn't archived. */
export const inFlight = (t: Task) =>
  t.status !== "done" && (t.status === "running" || wasDeployed(t));

/** Merged PRs get GitHub's merge glyph; anything still open keeps the PR one. */
export const prIcon = (t: Task): IconName =>
  t.prState === "merged" ? "merge" : "pr";

/** Status refined by what the run reported: merged, PR waiting, agent mid-work. */
function statusDisplay(t: Task): { label: string; cls: string; icon: IconName } {
  // real GitHub merge only — a manual "mark executed" stays EXECUTED, not MERGED
  if (t.prState === "merged") {
    return { label: "MERGED", cls: "text-ok", icon: "merge" };
  }
  if (t.prState === "closed") {
    return { label: "PR CLOSED", cls: "text-muted", icon: "x" };
  }
  // archived by hand without a merge → EXECUTED (before the PR-READY branch below)
  if (t.status === "done") {
    return STATUS_DISPLAY.done;
  }
  // a PR exists → the agent's done; blue PR READY wins over the amber pulse
  if (t.prUrl && t.status !== "running" && t.status !== "failed") {
    return { label: "PR READY", cls: "text-info", icon: "pr" };
  }
  if (t.status === "inbox" && wasDeployed(t)) {
    return { ...STATUS_DISPLAY.running, cls: "text-muted" }; // deployed, not running
  }
  if (t.status === "running" && t.runStatus === "RUNNING") {
    return { label: "AGENT WORKING", cls: "text-warn animate-pulse", icon: "crosshair" };
  }
  return STATUS_DISPLAY[t.status];
}

/** A merged PR's link is green; an open one is blue. */
function prLinkClass(task: Task): string {
  return task.mergedAt ? "text-ok" : "text-info";
}

/** External agent chat + PR links; both stay visible once a PR exists. */
function TaskExternalLinks({
  task,
  prClassName,
}: {
  task: Task;
  prClassName: string;
}) {
  if (!task.prUrl && !task.agentUrl) return null;
  return (
    <div className="flex shrink-0 items-center gap-2">
      {task.prUrl && (
        <a
          href={task.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-widest active:opacity-70 ${prClassName}`}
        >
          <Icon name={prIcon(task)} className="size-3.5" />
          {task.status === "running" ? "DRAFT" : task.prState === "merged" ? "MERGED" : "PR"}
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

// combine-* droppable ids mark the "absorb into group" middle band of a card
const COMBINE = "combine-";
const combineTargetOf = (id: string) =>
  id.startsWith(COMBINE) ? id.slice(COMBINE.length) : null;

// Grouped tasks are a contiguous run in the array; fold each run into one unit.
type Unit =
  | { kind: "task"; id: string; task: Task }
  | { kind: "group"; id: string; groupId: string; members: Task[] };

function toUnits(tasks: Task[]): Unit[] {
  const units: Unit[] = [];
  for (const t of tasks) {
    const last = units[units.length - 1];
    if (t.groupId && last?.kind === "group" && last.groupId === t.groupId) {
      last.members.push(t);
    } else if (t.groupId) {
      units.push({
        kind: "group",
        id: `group-${t.groupId}`,
        groupId: t.groupId,
        members: [t],
      });
    } else {
      units.push({ kind: "task", id: `unit-${t.id}`, task: t });
    }
  }
  return units;
}

function flatten(units: Unit[]): Task[] {
  return units.flatMap((u) => (u.kind === "task" ? [u.task] : u.members));
}

/** Inner sortables must not also start a drag on their parent card. */
function withStopPropagation(
  listeners: ReturnType<typeof useSortable>["listeners"],
) {
  const out: Record<string, (e: React.SyntheticEvent) => void> = {};
  for (const [key, handler] of Object.entries(listeners ?? {})) {
    out[key] = (e) => {
      e.stopPropagation();
      handler(e);
    };
  }
  return out;
}

export function TaskList({
  tasks,
  onReorder,
  onSelect,
  onSelectGroup,
  onToggle,
  onDelete,
  onDeploy,
  onDraggingChange,
}: {
  tasks: Task[];
  onReorder: (next: Task[]) => void;
  onSelect: (t: Task) => void;
  onSelectGroup: (groupId: string) => void;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
  onDeploy: (t: Task) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const units = toUnits(tasks);
  // Stable across SSR/client — dnd-kit's default id counter is module-scoped
  // and drifts, producing aria-describedby hydration mismatches.
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  // unit id currently hovered with "absorb into group" intent
  const [combineTarget, setCombineTarget] = useState<string | null>(null);
  // unit id briefly flashed when a drop was rejected for clashing repos
  const [clash, setClash] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // long-press lifts; a normal swipe moves >8px first, so scrolling keeps working
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function taskFor(dndId: string): Task | undefined {
    const id = dndId.replace(/^(unit|member)-/, "");
    return id === dndId ? undefined : tasks.find((t) => t.id === id);
  }

  // Where the active item may be sorted to: members sort within their group or
  // out to the top level; everything else sorts among top-level units.
  function candidateIds(active: string): Set<string> {
    const ids = new Set<string>();
    const gid = active.startsWith("member-") ? taskFor(active)?.groupId : null;
    for (const u of units) {
      if (u.kind === "group" && u.groupId === gid) {
        u.members.forEach((m) => ids.add(`member-${m.id}`));
      } else {
        ids.add(u.id);
      }
    }
    ids.delete(active);
    return ids;
  }

  // Middle band of a groupable card = combine intent; edges fall through to
  // normal sorting. combine-* ids live outside the SortableContexts, so while
  // hovering one the list holds still instead of opening a gap.
  const collision: CollisionDetection = (args) => {
    const active = String(args.active.id);
    const aTask = taskFor(active);
    if (aTask && deployable(aTask)) {
      const own = active.startsWith("member-")
        ? `${COMBINE}group-${aTask.groupId}`
        : `${COMBINE}${active}`;
      const hit = pointerWithin(args).find(
        (c) => String(c.id).startsWith(COMBINE) && String(c.id) !== own,
      );
      if (hit) return [hit];
    }
    const candidates = candidateIds(active);
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) =>
        candidates.has(String(c.id)),
      ),
    });
  };

  function reset() {
    setActiveId(null);
    setCombineTarget(null);
    onDraggingChange(false);
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    onDraggingChange(true);
    navigator.vibrate?.(10);
  }

  function handleDragOver({ over }: DragOverEvent) {
    const id = over ? String(over.id) : null;
    const target = id ? combineTargetOf(id) : null;
    if (target !== combineTarget) {
      if (target) navigator.vibrate?.(10);
      setCombineTarget(target);
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const a = String(active.id);
    reset();
    if (!over) return;
    const o = String(over.id);
    if (o === a) return;
    const aTask = taskFor(a);

    // absorb: form a group with the target, or join an existing one
    const combineId = combineTargetOf(o);
    if (combineId) {
      if (!aTask) return;
      const target = units.find((u) => u.id === combineId);
      if (!target) return;
      // no clashing repos in one group: block when both sides target different repos
      const tRepo = (target.kind === "group" ? target.members : [target.task])
        .find((t) => t.repoUrl)?.repoUrl;
      if (aTask.repoUrl && tRepo && tRepo !== aTask.repoUrl) {
        navigator.vibrate?.(50);
        setClash(target.id);
        setTimeout(() => setClash(null), 600);
        return;
      }
      const gid = target.kind === "group" ? target.groupId : newId();
      // the group's repo is its first member's with one; the target stays first
      const anchor =
        target.kind === "group"
          ? target.members[target.members.length - 1].id
          : target.task.id;
      const rest = tasks
        .filter((t) => t.id !== aTask.id)
        .map((t) =>
          target.kind === "task" && t.id === anchor ? { ...t, groupId: gid } : t,
        );
      const i = rest.findIndex((t) => t.id === anchor);
      if (i === -1) return;
      rest.splice(i + 1, 0, { ...aTask, groupId: gid });
      onReorder(normalizeGroups(rest));
      return;
    }

    // member: sort within its group, or drag out to the top level
    if (a.startsWith("member-")) {
      if (!aTask) return;
      if (o.startsWith("member-")) {
        const from = tasks.findIndex((t) => t.id === aTask.id);
        const to = tasks.findIndex((t) => `member-${t.id}` === o);
        if (from === -1 || to === -1) return;
        onReorder(arrayMove(tasks, from, to));
        return;
      }
      const target = units.find((u) => u.id === o);
      if (!target) return;
      const targetTasks = target.kind === "task" ? [target.task] : target.members;
      const rect = active.rect.current.translated;
      const after =
        !!rect && rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2;
      const anchor = after ? targetTasks[targetTasks.length - 1] : targetTasks[0];
      const rest = tasks.filter((t) => t.id !== aTask.id);
      const i = rest.findIndex((t) => t.id === anchor.id);
      if (i === -1) return;
      rest.splice(after ? i + 1 : i, 0, { ...aTask, groupId: undefined });
      onReorder(normalizeGroups(rest));
      return;
    }

    // top-level unit reorder
    const from = units.findIndex((u) => u.id === a);
    const to = units.findIndex((u) => u.id === o);
    if (from === -1 || to === -1) return;
    onReorder(flatten(arrayMove(units, from, to)));
  }

  const activeTask = activeId ? taskFor(activeId) : undefined;
  const activeGroup = activeId
    ? units.find((u): u is Unit & { kind: "group" } => u.id === activeId && u.kind === "group")
    : undefined;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
    >
      <SortableContext
        items={units.map((u) => u.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-2">
          {units.map((u) =>
            u.kind === "task" ? (
              <SortableShell
                key={u.id}
                id={u.id}
                combinable={deployable(u.task)}
              >
                <TaskRow
                  task={u.task}
                  highlight={combineTarget === u.id}
                  denied={clash === u.id}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onDeploy={onDeploy}
                />
              </SortableShell>
            ) : (
              <SortableGroup
                key={u.id}
                unit={u}
                highlight={combineTarget === u.id}
                denied={clash === u.id}
                onSelect={onSelect}
                onSelectGroup={onSelectGroup}
                onDelete={onDelete}
                onDeploy={onDeploy}
              />
            ),
          )}
        </ul>
      </SortableContext>
      <DragOverlay>
        {activeTask ? (
          <div className="scale-[1.03] shadow-lg shadow-black/50">
            <TaskRow task={activeTask} />
          </div>
        ) : activeGroup ? (
          <div className="scale-[1.03] rounded-xl border border-edge bg-surface shadow-lg shadow-black/50">
            <GroupHeader members={activeGroup.members} />
            <ul>
              {activeGroup.members.map((m) => (
                <li
                  key={m.id}
                  className="border-t border-edge px-4 py-2.5 text-sm"
                >
                  {m.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Completed marks, newest first, folded away. No drag — order is by doneAt. */
export function DoneList({
  tasks,
  onSelect,
  onToggle,
  onDelete,
}: {
  tasks: Task[];
  onSelect: (t: Task) => void;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <details className="group mt-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-2 font-mono text-[11px] uppercase tracking-widest text-muted [&::-webkit-details-marker]:hidden">
        <Icon
          name="chevron"
          className="size-4 -rotate-90 transition-transform group-open:rotate-0"
        />
        {tasks.length} executed
      </summary>
      <ul className="flex flex-col gap-2 pt-2">
        {tasks.map((t) => (
          <li key={t.id}>
            <TaskRow
              task={t}
              onSelect={onSelect}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}

type RowAction = {
  icon: IconName;
  label: string;
  destructive?: boolean;
  onClick: () => void;
};

/**
 * Row chrome shared by tasks and group members: on touch, swiping left reveals
 * the action tray (native scroll-snap, no gesture code); on pointer devices an
 * ellipsis in the top-right corner opens the same actions as a dropdown.
 */
function ActionRow({
  actions,
  className = "",
  rowClassName,
  trailing,
  children,
}: {
  actions: RowAction[];
  className?: string;
  rowClassName: string;
  /** Card call-to-action (PR / View agent) pinned to the bottom-right. */
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <div className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[inherit] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          className={`w-full shrink-0 snap-start ${rowClassName} ${
            actions.length ? "pointer-fine:pr-2" : ""
          }`}
        >
          {children}
          {(actions.length > 0 || trailing) && (
            <div className="flex shrink-0 flex-col items-end self-stretch">
              {actions.length > 0 && (
                <button
                  onClick={() => setOpen((o) => !o)}
                  aria-label="More actions"
                  className="hidden p-1 text-muted hover:text-foreground pointer-fine:block"
                >
                  <Icon name="ellipsis" className="size-4" />
                </button>
              )}
              {trailing && <div className="mt-auto">{trailing}</div>}
            </div>
          )}
        </div>
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            aria-label={a.label}
            className={`flex w-16 shrink-0 snap-end items-center justify-center active:opacity-80 ${
              a.destructive ? "bg-blood text-white" : "bg-ok text-black"
            }`}
          >
            <Icon name={a.icon} className="size-5" />
          </button>
        ))}
      </div>
      {/* popover lives outside the overflow-x scroller so it isn't clipped */}
      {open && actions.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-2 top-9 z-20 min-w-40 overflow-hidden rounded-xl border border-edge bg-surface shadow-lg shadow-black/50">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-background ${
                  a.destructive ? "text-blood" : ""
                }`}
              >
                <Icon name={a.icon} className="size-4" />
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TaskRow({
  task,
  highlight,
  denied,
  onSelect,
  onToggle,
  onDelete,
  onDeploy,
}: {
  task: Task;
  highlight?: boolean;
  /** Flashes when a drop onto this row was rejected (clashing repos). */
  denied?: boolean;
  onSelect?: (t: Task) => void;
  onToggle?: (t: Task) => void;
  onDelete?: (id: string) => void;
  onDeploy?: (t: Task) => void;
}) {
  const actions: RowAction[] = [];
  // only when a repo is tagged — otherwise open the sheet to tag one first
  if (onDeploy && deployable(task) && task.repoUrl)
    actions.push({
      icon: "crosshair",
      label: "Deploy agent",
      onClick: () => onDeploy(task),
    });
  if (onToggle)
    actions.push({
      icon: task.status === "done" ? "crosshair" : "check",
      label: task.status === "done" ? "Unmark" : "Mark executed",
      onClick: () => onToggle(task),
    });
  if (onDelete)
    actions.push({
      icon: "trash",
      label: "Delete",
      destructive: true,
      onClick: () => onDelete(task.id),
    });
  return (
    <ActionRow
      actions={actions}
      className={`rounded-xl border border-edge bg-surface transition-transform ${
        highlight ? "scale-[1.02] ring-2 ring-blood" : ""
      } ${denied ? "animate-pulse ring-2 ring-blood/50" : ""}`}
      rowClassName="flex items-center gap-3 px-4 py-3"
      trailing={
        <TaskExternalLinks task={task} prClassName="text-ok" />
      }
    >
      <button
        onClick={() => onSelect?.(task)}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
      >
        <span
          className={`break-words ${
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
        {(task.status !== "inbox" || wasDeployed(task)) && (
          <StatusBadge task={task} />
        )}
        {task.agentSummary && (
          <span className="w-full truncate text-xs text-muted">
            {task.agentSummary}
          </span>
        )}
      </button>
    </ActionRow>
  );
}

/** Sortable <li> wiring + the combine drop zone, shared by tasks and groups. */
function SortableShell({
  id,
  combinable,
  children,
}: {
  id: string;
  combinable: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const { setNodeRef: setCombineRef } = useDroppable({
    id: `${COMBINE}${id}`,
    disabled: !combinable,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`relative select-none [-webkit-touch-callout:none] ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {children}
      {/* drop zone only — dnd-kit measures its rect, so it must not eat taps */}
      <div
        ref={setCombineRef}
        className="pointer-events-none absolute inset-x-0 top-1/4 bottom-1/4"
      />
    </li>
  );
}

function GroupHeader({
  members,
  onClick,
}: {
  members: Task[];
  onClick?: () => void;
}) {
  const lead = members[0];
  // the lead may be repo-less; the group's repo is the first member's with one
  const repo = members.find((m) => m.repoUrl)?.repoUrl?.split("/").pop();
  return (
    <div className="flex items-center gap-2 pr-4">
      <button
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 px-4 py-2.5 text-left"
      >
        <Icon name="crosshair" className="size-4 shrink-0 text-blood" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-widest text-muted">
          {repo ?? "group"} · {members.length} marks
        </span>
        {(lead.status !== "inbox" || wasDeployed(lead)) && (
          <StatusBadge task={lead} />
        )}
      </button>
      <TaskExternalLinks task={lead} prClassName={prLinkClass(lead)} />
    </div>
  );
}

function SortableGroup({
  unit,
  highlight,
  denied,
  onSelect,
  onSelectGroup,
  onDelete,
  onDeploy,
}: {
  unit: Extract<Unit, { kind: "group" }>;
  highlight: boolean;
  /** Flashes when a drop onto this group was rejected (clashing repos). */
  denied: boolean;
  onSelect: (t: Task) => void;
  onSelectGroup: (groupId: string) => void;
  onDelete: (id: string) => void;
  onDeploy: (t: Task) => void;
}) {
  // group deploys as one; any member's action dispatches the whole group
  const canDeployGroup =
    unit.members.every(deployable) && unit.members.some((m) => m.repoUrl);
  return (
    <SortableShell
      id={unit.id}
      combinable={unit.members.every(deployable)}
    >
      <div
        className={`rounded-xl border border-edge bg-surface transition-transform ${
          highlight ? "scale-[1.02] ring-2 ring-blood" : ""
        } ${denied ? "animate-pulse ring-2 ring-blood/50" : ""}`}
      >
        <GroupHeader
          members={unit.members}
          onClick={() => onSelectGroup(unit.groupId)}
        />
        <SortableContext
          items={unit.members.map((m) => `member-${m.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <ul>
            {unit.members.map((m) => (
              <SortableMember
                key={m.id}
                task={m}
                canDeploy={canDeployGroup}
                onSelect={onSelect}
                onDelete={onDelete}
                onDeploy={onDeploy}
              />
            ))}
          </ul>
        </SortableContext>
      </div>
    </SortableShell>
  );
}

function SortableMember({
  task,
  canDeploy,
  onSelect,
  onDelete,
  onDeploy,
}: {
  task: Task;
  canDeploy: boolean;
  onSelect: (t: Task) => void;
  onDelete: (id: string) => void;
  onDeploy: (t: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `member-${task.id}` });
  const actions: RowAction[] = [];
  if (canDeploy)
    actions.push({
      icon: "crosshair",
      label: "Deploy group",
      onClick: () => onDeploy(task),
    });
  actions.push({
    icon: "trash",
    label: "Delete",
    destructive: true,
    onClick: () => onDelete(task.id),
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...withStopPropagation(listeners)}
      className={`border-t border-edge select-none [-webkit-touch-callout:none] ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <ActionRow
        actions={actions}
        rowClassName="flex items-center gap-3 px-4 py-2.5"
      >
        {/* tap a member to give it its own context; the group still deploys as one */}
        <button
          onClick={() => onSelect(task)}
          className={`flex min-w-0 flex-1 items-center gap-2 break-words text-left text-sm ${
            task.status === "done" ? "text-muted line-through decoration-blood/70" : ""
          }`}
        >
          <span className="min-w-0 break-words">{task.title}</span>
          {task.details && (
            <Icon name="list" className="size-3 shrink-0 text-muted" />
          )}
        </button>
      </ActionRow>
    </li>
  );
}
