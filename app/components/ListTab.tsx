import type { Task } from "@/app/lib/tasks";
import { Icon } from "@/app/components/Icons";
import { Button } from "@/app/components/Button";
import { DoneList, FoldSection, TaskList } from "@/app/components/TaskList";
import { Chip } from "@/app/components/ui/Chip";

interface ListTabProps {
  activeProjectFilter: Set<string>;
  onSelectProjectsChange: (projects: Set<string>) => void;
  onSelectId: (id: string) => void;
  onSelectGroup: (groupId: string) => void;
  visible: Task[];
  flying: Task[];
  pending: Task[];
  done: Task[];
  tasks: Task[];
  loading: boolean;
  onReorderVisible: (flying: Task[], pending: Task[], done: Task[]) => void;
  onToggleTask: (task: Task) => void;
  onRemoveTask: (id: string) => void;
  onDeployTask: (task: Task) => void;
  onDraggingChange: (dragging: boolean) => void;
  showSetupCta: boolean;
  hasProjects: boolean;
  onOpenFilter: () => void;
}

export function ListTab({
  activeProjectFilter,
  onSelectProjectsChange,
  onSelectId,
  onSelectGroup,
  visible,
  flying,
  pending,
  done,
  tasks,
  loading,
  onReorderVisible,
  onToggleTask,
  onRemoveTask,
  onDeployTask,
  onDraggingChange,
  showSetupCta,
  hasProjects,
  onOpenFilter,
}: ListTabProps) {
  const filterActive = activeProjectFilter.size > 0;
  const listEmpty = visible.length === 0;

  return (
    <>
      {hasProjects && (
        <div className="mb-3 flex flex-wrap justify-end items-center gap-2">
          <Chip
            variant="surface"
            icon="filter"
            onClick={onOpenFilter}
            aria-label={
              filterActive
                ? `Filter by project, ${activeProjectFilter.size} selected`
                : "Filter by project"
            }
          >
            Filter{filterActive ? ` · ${activeProjectFilter.size}` : ""}
          </Chip>
        </div>
      )}
      {loading ? (
        <p className="font-mono text-sm uppercase tracking-widest text-muted">
          Scanning…
        </p>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center pt-12">
          <Icon name="crosshair" className="mb-3 size-10 text-edge" />
          <p className="font-mono text-sm uppercase tracking-widest text-muted">
            No active marks
          </p>
          {showSetupCta && (
            <Button
              variant="ghost"
              href="/app/settings"
              className="mt-4 font-mono text-xs"
            >
              Finish setup in Settings →
            </Button>
          )}
        </div>
      ) : listEmpty ? (
        <div className="flex flex-col items-center pt-12">
          <Icon name="filter" className="mb-3 size-10 text-edge" />
          <p className="font-mono text-sm uppercase tracking-widest text-muted">
            No hits match filter
          </p>
          <Button
            variant="ghost"
            onClick={() => onSelectProjectsChange(new Set())}
            className="mt-4 font-mono text-xs"
          >
            Clear project filter
          </Button>
        </div>
      ) : (
        <>
          {flying.length > 0 && (
            <FoldSection
              label={`${flying.length} deployed`}
              className="mt-0"
              defaultOpen
            >
              <div className="pt-2">
                <TaskList
                  tasks={flying}
                  onReorder={(next) => onReorderVisible(next, pending, done)}
                  onSelect={(t) => onSelectId(t.id)}
                  onSelectGroup={onSelectGroup}
                  onToggle={onToggleTask}
                  onDelete={onRemoveTask}
                  onDeploy={onDeployTask}
                  onDraggingChange={onDraggingChange}
                />
              </div>
            </FoldSection>
          )}
          {pending.length > 0 && (
            <FoldSection
              label={`${pending.length} marked`}
              className={flying.length > 0 ? "mt-4" : "mt-0"}
              defaultOpen
            >
              <div className="pt-2">
                <TaskList
                  tasks={pending}
                  onReorder={(next) => onReorderVisible(flying, next, done)}
                  onSelect={(t) => onSelectId(t.id)}
                  onSelectGroup={onSelectGroup}
                  onToggle={onToggleTask}
                  onDelete={onRemoveTask}
                  onDeploy={onDeployTask}
                  onDraggingChange={onDraggingChange}
                />
              </div>
            </FoldSection>
          )}
          {done.length > 0 && (
            <DoneList
              tasks={done}
              onSelect={(t) => onSelectId(t.id)}
              onToggle={onToggleTask}
              onDelete={onRemoveTask}
            />
          )}
        </>
      )}
    </>
  );
}
