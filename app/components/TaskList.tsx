"use client";

import { useState } from "react";
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

export function StatusBadge({ status }: { status: TaskStatus }) {
  const s = STATUS_DISPLAY[status];
  return (
    <span
      className={`flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest ${s.cls}`}
    >
      <Icon name={s.icon} className="size-3" />
      {s.label}
    </span>
  );
}

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
  onDraggingChange,
}: {
  tasks: Task[];
  onReorder: (next: Task[]) => void;
  onSelect: (t: Task) => void;
  onSelectGroup: (groupId: string) => void;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const units = toUnits(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  // unit id currently hovered with "absorb into group" intent
  const [combineTarget, setCombineTarget] = useState<string | null>(null);

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
    if (aTask?.status === "inbox") {
      const own = active.startsWith("member-")
        ? `combine-group-${aTask.groupId}`
        : `combine-${active}`;
      const hit = pointerWithin(args).find(
        (c) => String(c.id).startsWith("combine-") && String(c.id) !== own,
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
    const target = id?.startsWith("combine-") ? id.slice(8) : null;
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
    if (o.startsWith("combine-")) {
      if (!aTask) return;
      const target = units.find((u) => u.id === o.slice(8));
      if (!target) return;
      const gid = target.kind === "group" ? target.groupId : crypto.randomUUID();
      // target stays first, so the group adopts the target's repo
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
              <SortableTask
                key={u.id}
                unit={u}
                highlight={combineTarget === u.id}
                onSelect={onSelect}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ) : (
              <SortableGroup
                key={u.id}
                unit={u}
                highlight={combineTarget === u.id}
                onSelectGroup={onSelectGroup}
                onDelete={onDelete}
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

function TaskRow({
  task,
  highlight,
  onSelect,
  onToggle,
  onDelete,
}: {
  task: Task;
  highlight?: boolean;
  onSelect?: (t: Task) => void;
  onToggle?: (t: Task) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-edge bg-surface px-4 py-3 transition-transform ${
        highlight ? "scale-[1.02] ring-2 ring-blood" : ""
      }`}
    >
      <button
        onClick={() => onToggle?.(task)}
        aria-label={
          task.status === "done"
            ? `Mark ${task.title} as not done`
            : `Mark ${task.title} as done`
        }
        className={`shrink-0 ${
          task.status === "done" ? "text-blood" : "text-muted"
        }`}
      >
        <Icon
          name={task.status === "done" ? "x" : "crosshair"}
          className="size-5"
        />
      </button>
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
        {task.status !== "inbox" && <StatusBadge status={task.status} />}
      </button>
      <button
        onClick={() => onDelete?.(task.id)}
        aria-label="Delete task"
        className="shrink-0 text-muted active:text-blood"
      >
        <Icon name="trash" className="size-4" />
      </button>
    </div>
  );
}

function SortableTask({
  unit,
  highlight,
  onSelect,
  onToggle,
  onDelete,
}: {
  unit: Extract<Unit, { kind: "task" }>;
  highlight: boolean;
  onSelect: (t: Task) => void;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: unit.id });
  const { setNodeRef: setCombineRef } = useDroppable({
    id: `combine-${unit.id}`,
    disabled: unit.task.status !== "inbox",
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
      <TaskRow
        task={unit.task}
        highlight={highlight}
        onSelect={onSelect}
        onToggle={onToggle}
        onDelete={onDelete}
      />
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
  const status = members[0].status;
  const repo = members[0].repoUrl?.split("/").pop();
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
    >
      <Icon name="crosshair" className="size-4 shrink-0 text-blood" />
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-widest text-muted">
        {repo ?? "group"} · {members.length} marks
      </span>
      {status !== "inbox" && <StatusBadge status={status} />}
    </button>
  );
}

function SortableGroup({
  unit,
  highlight,
  onSelectGroup,
  onDelete,
}: {
  unit: Extract<Unit, { kind: "group" }>;
  highlight: boolean;
  onSelectGroup: (groupId: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: unit.id });
  const groupable = unit.members.every((m) => m.status === "inbox");
  const { setNodeRef: setCombineRef } = useDroppable({
    id: `combine-${unit.id}`,
    disabled: !groupable,
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
      <div
        className={`rounded-xl border border-edge bg-surface transition-transform ${
          highlight ? "scale-[1.02] ring-2 ring-blood" : ""
        }`}
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
              <SortableMember key={m.id} task={m} onDelete={onDelete} />
            ))}
          </ul>
        </SortableContext>
      </div>
      {/* drop zone only — dnd-kit measures its rect, so it must not eat taps */}
      <div
        ref={setCombineRef}
        className="pointer-events-none absolute inset-x-0 top-1/4 bottom-1/4"
      />
    </li>
  );
}

function SortableMember({
  task,
  onDelete,
}: {
  task: Task;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `member-${task.id}` });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...withStopPropagation(listeners)}
      className={`flex items-center gap-3 border-t border-edge px-4 py-2.5 select-none [-webkit-touch-callout:none] ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span
        className={`min-w-0 flex-1 break-words text-sm ${
          task.status === "done" ? "text-muted line-through decoration-blood/70" : ""
        }`}
      >
        {task.title}
      </span>
      <button
        onClick={() => onDelete(task.id)}
        aria-label="Delete task"
        className="shrink-0 text-muted active:text-blood"
      >
        <Icon name="trash" className="size-4" />
      </button>
    </li>
  );
}
