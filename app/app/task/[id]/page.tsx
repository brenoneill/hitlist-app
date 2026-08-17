"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  useMarkPrDraft,
  usePrDetails,
  useRemoveTask,
  useTasks,
  useToggleDone,
} from "@/app/lib/queries";
import { PROVIDER_META } from "@/app/lib/providerMeta";
import { AppHeader } from "@/app/components/AppHeader";
import { Conversation } from "@/app/components/Conversation";
import { Icon } from "@/app/components/Icons";
import { PrTab } from "@/app/components/PrTab";
import { elapsed, useQuickRedeploy } from "@/app/components/Sheets";
import { TabPanel, Tabs } from "@/app/components/Tabs";
import { StatusBadge, agentIcon, redeployable } from "@/app/components/TaskItem";
import { ErrorText } from "@/app/components/ui/ErrorText";
import { Menu, MenuItem } from "@/app/components/ui/Menu";
import { Skeleton } from "@/app/components/ui/Skeleton";

type WorkspaceTab = "agent" | "pr";

/** Mission workspace: full agent conversation + in-app PR review and merge. */
export default function TaskWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: tasks, isLoading } = useTasks();
  const task = tasks?.find((t) => t.id === id);
  const members = task?.groupId
    ? (tasks ?? []).filter((t) => t.groupId === task.groupId)
    : [];
  // the task arrives async, so derive the default rather than syncing it in an effect
  const urlTab = useSearchParams().get("tab");
  const tab: WorkspaceTab =
    urlTab === "agent" || urlTab === "pr"
      ? urlTab
      : task?.prUrl
        ? "pr"
        : "agent";
  // native replaceState integrates with useSearchParams (Next SPA guide) —
  // shareable/refresh-stable tab without history entries
  const setTab = (t: WorkspaceTab) =>
    window.history.replaceState(null, "", `/app/task/${id}?tab=${t}`);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleDone = useToggleDone();
  const removeTask = useRemoveTask();
  const markDraft = useMarkPrDraft(id);
  const { data: pr } = usePrDetails(
    id,
    !!task?.prUrl && task.prState !== "merged",
  );
  const { redeploy, pending: redeploying, error: redeployError } =
    useQuickRedeploy();
  const canRedeploy =
    !!task &&
    redeployable(task) &&
    (members.length > 1 ? members.some((m) => m.repoUrl) : !!task.repoUrl);
  const canMarkDraft = !!pr && pr.state === "open" && !pr.draft;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <AppHeader />

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
            {/* z-40 while open so the menu stacks above the sticky z-30 tab bar */}
            <div
              className={`relative flex items-start gap-2 ${menuOpen ? "z-40" : ""}`}
            >
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-lg font-medium">
                {task.title}
              </p>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="More actions"
                className="shrink-0 p-1 text-muted hover:text-foreground"
              >
                <Icon name="ellipsis" className="size-4" />
              </button>
              <Menu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                className="right-0 top-8 min-w-40"
              >
                {canRedeploy && (
                  <MenuItem
                    icon="crosshair"
                    disabled={redeploying}
                    onClick={() => {
                      setMenuOpen(false);
                      redeploy(task.id);
                    }}
                  >
                    {task.groupId ? "Redispatch group" : "Redispatch"}
                  </MenuItem>
                )}
                <MenuItem
                  icon={task.status === "done" ? "x" : "check"}
                  disabled={toggleDone.isPending}
                  onClick={() => {
                    setMenuOpen(false);
                    toggleDone.mutate(task);
                  }}
                >
                  {task.status === "done" ? "Unmark" : "Mark as executed"}
                </MenuItem>
                {canMarkDraft && (
                  <MenuItem
                    icon="pr"
                    disabled={markDraft.isPending}
                    onClick={() => {
                      setMenuOpen(false);
                      markDraft.mutate();
                    }}
                  >
                    Mark as draft
                  </MenuItem>
                )}
                {task.agentUrl && task.provider && (
                  <MenuItem
                    icon={agentIcon(task)}
                    href={task.agentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                  >
                    Open in {PROVIDER_META[task.provider].label} ↗
                  </MenuItem>
                )}
                {task.prUrl && (
                  <MenuItem
                    icon="pr"
                    href={task.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                  >
                    View PR on GitHub ↗
                  </MenuItem>
                )}
                <MenuItem
                  icon="trash"
                  destructive
                  onClick={() => {
                    setMenuOpen(false);
                    removeTask.mutate(task.id);
                    router.push("/app");
                  }}
                >
                  Delete
                </MenuItem>
              </Menu>
            </div>
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
            {task.prUrl && (
              <a
                href={task.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-1 font-mono text-xs text-muted underline-offset-4 hover:underline"
              >
                <span className="truncate">See PR in GitHub</span>
                <Icon name="external" className="size-3 shrink-0" />
              </a>
            )}
            {task.agentUrl ? (
              <a
                href={task.agentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-1 font-mono text-xs text-muted underline-offset-4 hover:underline"
              >
                <Icon name={agentIcon(task)} className="size-3 shrink-0" />
                <span className="truncate">See Agent in Cursor</span>
                <Icon name="external" className="size-3 shrink-0" />
              </a>
            ) : (
              task.branch && (
                <p className="truncate font-mono text-xs text-muted">
                  <Icon
                    name="pr"
                    className="mr-1 inline size-3 align-[-2px]"
                  />
                  {task.branch}
                </p>
              )
            )}
            {redeployError && (
              <ErrorText>
                {redeployError.message || "redispatch failed"}
              </ErrorText>
            )}
            {markDraft.error && (
              <ErrorText>
                {markDraft.error.message || "mark as draft failed"}
              </ErrorText>
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
            onChange={setTab}
          >
            <TabPanel id="agent">
              <Conversation task={task} onShowPr={() => setTab("pr")} />
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
      {/* mirrors the loaded header: title, status badge, PR + agent link lines */}
      <div className="mb-6 flex flex-col gap-1">
        <Skeleton className="h-7 w-2/3 rounded bg-edge" />
        <Skeleton className="h-5 w-24 rounded-full bg-edge" />
        <Skeleton className="h-4 w-1/2 rounded bg-edge" />
        <Skeleton className="h-4 w-2/5 rounded bg-edge" />
      </div>
      <TabBarSkeleton />
      <Skeleton className="h-72 rounded-xl border border-edge bg-surface" />
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


