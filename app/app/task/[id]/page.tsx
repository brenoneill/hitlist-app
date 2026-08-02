"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { Task } from "@/app/lib/tasks";
import {
  useSendMessage,
  useTaskMessages,
  useTasks,
} from "@/app/lib/queries";
import { PROVIDER_META } from "@/app/lib/providerMeta";
import { Button } from "@/app/components/Button";
import { Icon } from "@/app/components/Icons";
import { PrTab } from "@/app/components/PrTab";
import { elapsed } from "@/app/components/Sheets";
import { TabPanel, Tabs } from "@/app/components/Tabs";
import { StatusBadge, wasDeployed } from "@/app/components/TaskItem";
import { ErrorText } from "@/app/components/ui/ErrorText";
import { Markdownish } from "@/app/components/ui/Markdownish";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { Textarea } from "@/app/components/ui/Textarea";

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
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/app"
          aria-label="Back to hitlist"
          className="-ml-1 p-1 text-muted active:text-foreground"
        >
          <Icon name="chevron" className="size-5 rotate-90" />
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Icon name="crosshair" className="size-6 text-blood" />
          HITLIST
        </h1>
      </div>

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
              <Conversation task={task} />
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

function Conversation({ task }: { task: Task }) {
  const [draft, setDraft] = useState("");
  const running = task.status === "running";
  const { data: messages } = useTaskMessages(task.id, running);
  const sendMessage = useSendMessage(task.id);
  const supportsFollowups =
    !!task.provider && PROVIDER_META[task.provider].supportsFollowups;

  // pre-feature dispatches have no stored turns — synthesize the prompt from the
  // task; the run summary has its own home in the PR tab
  const shown = messages?.length
    ? messages
    : [
        {
          id: "local-prompt",
          role: "user" as const,
          body:
            `# Task\n${task.title}` +
            (task.details ? `\n\n## Context\n${task.details}` : ""),
        },
      ];

  function send() {
    const text = draft.trim();
    if (!text) return;
    sendMessage.mutate(text, { onSuccess: () => setDraft("") });
  }

  if (!wasDeployed(task) && !messages?.length) {
    return (
      <p className="mb-6 font-mono text-xs text-muted">
        No agent deployed yet — deploy from the hitlist to start.
      </p>
    );
  }

  return (
    <section className="mb-6">
      {supportsFollowups && task.agentUrl && (
        <p className="mb-2 text-right">
          <a
            href={task.agentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap font-mono text-xs text-muted underline underline-offset-4"
          >
            Open agent ↗
          </a>
        </p>
      )}
      <div className="flex flex-col gap-2">
        {shown.map((m) => (
          <div
            key={m.id}
            className={`max-w-[88%] rounded-xl border px-4 py-3 text-sm ${
              m.role === "user"
                ? "self-end border-blood/30 bg-blood/10"
                : "self-start border-edge bg-surface text-muted"
            }`}
          >
            <Markdownish text={m.body} />
          </div>
        ))}
        {running && (
          <p className="self-start font-mono text-[11px] uppercase tracking-widest text-warn animate-pulse">
            Agent working…
          </p>
        )}
      </div>

      {supportsFollowups && task.agentId ? (
        <div className="mt-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              running
                ? "Agent is working — reply when it finishes"
                : "Send a follow-up… (pushes to the same PR)"
            }
            disabled={running || sendMessage.isPending}
            aria-label="Follow-up for the agent"
            className="min-h-[3.5rem]"
          />
          <Button
            onClick={send}
            disabled={running || sendMessage.isPending || !draft.trim()}
            className="mt-2 w-full"
          >
            {sendMessage.isPending ? "Sending…" : "Send follow-up"}
          </Button>
          {sendMessage.error && (
            <ErrorText className="mt-2">{sendMessage.error.message}</ErrorText>
          )}
        </div>
      ) : (
        task.agentUrl && (
          <Button
            href={task.agentUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            className="mt-3 flex w-full items-center justify-center gap-2 active:bg-background"
          >
            Continue with the agent
            <Icon name="external" className="size-4" />
          </Button>
        )
      )}
    </section>
  );
}

