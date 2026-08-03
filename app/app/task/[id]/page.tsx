"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTasks } from "@/app/lib/queries";
import { PROVIDER_META } from "@/app/lib/providerMeta";
import { AppHeader } from "@/app/components/AppHeader";
import { Conversation } from "@/app/components/Conversation";
import { Icon } from "@/app/components/Icons";
import { PrTab } from "@/app/components/PrTab";
import { elapsed } from "@/app/components/Sheets";
import { TabPanel, Tabs } from "@/app/components/Tabs";
import { StatusBadge } from "@/app/components/TaskItem";
import { Skeleton } from "@/app/components/ui/Skeleton";

type WorkspaceTab = "agent" | "pr";

/** Mission workspace: full agent conversation + in-app PR review and merge. */
export default function TaskWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { data: tasks, isLoading } = useTasks();
  const task = tasks?.find((t) => t.id === id);
  const members = task?.groupId
    ? (tasks ?? []).filter((t) => t.groupId === task.groupId)
    : [];
  // the task arrives async, so derive the default rather than syncing it in an effect
  const urlTab = useSearchParams().get("tab");
  const [picked, setPicked] = useState<WorkspaceTab | null>(null);
  const tab =
    picked ??
    (urlTab === "agent" || urlTab === "pr" ? urlTab : null) ??
    (task?.prUrl ? "pr" : "agent");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <AppHeader backHref="/app" />

      {!task ? (
        isLoading ? (
          <WorkspaceSkeleton />
        ) : (
          <p className="font-mono text-sm text-muted">
            Mark not found — it may have been deleted.
          </p>
        )
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-1">
            <p className="whitespace-pre-wrap break-words text-lg font-medium">
              {task.title}
            </p>
            {members.length > 1 && (
              <p className="font-mono text-xs text-muted">
                Group of {members.length}:{" "}
                {members.map((m) => m.title).join(" · ")}
              </p>
            )}
            <div className="flex items-center gap-1.5">
              {task.provider && (
                <Icon
                  name={PROVIDER_META[task.provider].icon}
                  className="size-3.5 shrink-0 text-muted"
                />
              )}
              <StatusBadge task={task} />
            </div>
            {task.status === "running" && task.dispatchedAt && (
              <p className="font-mono text-xs text-warn">
                Working for {elapsed(task.dispatchedAt)}
              </p>
            )}
            {task.repoUrl && (
              <p className="truncate font-mono text-xs text-muted">
                {task.repoUrl}
              </p>
            )}
            {task.branch && (
              <p className="truncate font-mono text-xs text-muted">
                <Icon name="pr" className="mr-1 inline size-3 align-[-2px]" />
                {task.branch}
              </p>
            )}
          </div>

          <Tabs
            tabs={[
              {
                id: "agent",
                label: "Agent",
                icon: task.provider
                  ? PROVIDER_META[task.provider].icon
                  : "crosshair",
              },
              { id: "pr", label: "PR", icon: "pr" },
            ]}
            active={tab}
            onChange={setPicked}
          >
            <TabPanel id="agent">
              <Conversation task={task} onShowPr={() => setPicked("pr")} />
            </TabPanel>
            <TabPanel id="pr">
              <PrTab task={task} />
            </TabPanel>
          </Tabs>
        </>
      )}
    </main>
  );
}

/** Mirrors the loaded layout's title + tab bar + panel so nothing jumps once the task arrives. */
function WorkspaceSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading mission</span>
      <Skeleton className="mb-6 h-6 w-2/3 rounded bg-edge" />
      <TabBarSkeleton />
      <Skeleton className="h-40 rounded-xl border border-edge bg-surface" />
    </div>
  );
}

function TabBarSkeleton() {
  return (
    <div className="mb-4 flex gap-1 rounded-xl border border-edge bg-surface p-1">
      <Skeleton className="h-9 flex-1 rounded-lg bg-edge" />
      <Skeleton className="h-9 flex-1 rounded-lg bg-edge" />
    </div>
  );
}


