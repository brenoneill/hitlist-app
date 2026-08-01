import type { Task } from "@/app/lib/tasks";
import { Icon } from "@/app/components/Icons";
import { Button } from "@/app/components/Button";
import { DoneList, FoldSection, TaskList } from "@/app/components/TaskList";

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
  setupComplete: boolean;
  onGoToSettings: () => void;
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
  setupComplete,
  onGoToSettings,
}: ListTabProps) {
  const filterActive = activeProjectFilter.size > 0;
  const listEmpty = visible.length === 0;

  return (
    <>
      {filterActive && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[...activeProjectFilter].map((url) => {
            const name = url.split("/").pop() ?? url;
            return (
              <button
                key={url}
                type="button"
                onClick={() => {
                  const next = new Set(activeProjectFilter);
                  next.delete(url);
                  onSelectProjectsChange(next);
                }}
                className="flex items-center gap-1.5 rounded-full border border-info/40 bg-info/10 px-3 py-1 font-mono text-xs text-info transition-colors active:bg-info/20"
              >
                <Icon name="filter" className="size-3" />
                {name}
                <Icon name="x" className="size-3" />
                <span className="sr-only">Remove {name} filter</span>
              </button>
            );
          })}
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
          {!setupComplete && (
            <Button
              variant="ghost"
              onClick={onGoToSettings}
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
            <FoldSection label={`${flying.length} deployed`} className="mt-0">
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
