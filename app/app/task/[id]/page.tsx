"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Deployment, PrFile } from "@/app/lib/githubApp";
import type { Task } from "@/app/lib/tasks";
import {
  useMergePr,
  usePrDetails,
  useSendMessage,
  useTaskMessages,
  useTasks,
} from "@/app/lib/queries";
import { PROVIDER_META } from "@/app/lib/providerMeta";
import { Button } from "@/app/components/Button";
import { Icon } from "@/app/components/Icons";
import { elapsed } from "@/app/components/Sheets";
import { TabPanel, Tabs } from "@/app/components/Tabs";
import { StatusBadge, wasDeployed } from "@/app/components/TaskItem";
import { ErrorText } from "@/app/components/ui/ErrorText";
import { FieldLabel } from "@/app/components/ui/FieldLabel";
import { Markdownish } from "@/app/components/ui/Markdownish";
import { OverlayDialog } from "@/app/components/ui/OverlayDialog";
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
  const [picked, setPicked] = useState<WorkspaceTab | null>(null);
  const tab = picked ?? (task?.prUrl ? "pr" : "agent");

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
          <div aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading mission</span>
            <div className="mb-3 h-6 w-2/3 animate-pulse rounded bg-edge motion-reduce:animate-none" />
            <div className="h-40 animate-pulse rounded-xl border border-edge bg-surface motion-reduce:animate-none" />
          </div>
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
              <PrSection task={task} />
            </TabPanel>
          </Tabs>
        </>
      )}
    </main>
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

function PrSection({ task }: { task: Task }) {
  const [confirming, setConfirming] = useState(false);
  const { data: pr, error, isLoading } = usePrDetails(task.id, !!task.prUrl);
  const mergeMutation = useMergePr(task.id);

  return (
    <section className="mb-6">
      {task.agentSummary && (
        <>
          <FieldLabel as="h2" className="mb-2">
            Summary
          </FieldLabel>
          <div className="mb-4 rounded-xl border border-edge bg-surface px-4 py-3 text-sm text-muted">
            <Markdownish text={task.agentSummary} />
          </div>
        </>
      )}

      <Deployments task={task} deployments={pr?.deployments} />

      <FieldLabel as="h2" className="mb-2">
        Pull request
      </FieldLabel>

      {!task.prUrl ? (
        <p className="font-mono text-xs text-muted">
          No pull request yet — it appears once the agent pushes.
        </p>
      ) : (
        <>
          {isLoading && (
            <div className="h-24 animate-pulse rounded-xl border border-edge bg-surface motion-reduce:animate-none" />
          )}
          {error && (
            <>
              <ErrorText className="mb-2">{error.message}</ErrorText>
              <Button
                href={task.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                className="flex w-full items-center justify-center gap-2 active:bg-background"
              >
                View PR on GitHub
                <Icon name="external" className="size-4" />
              </Button>
            </>
          )}
          {pr && (
            <>
              <div className="mb-3 rounded-xl border border-edge bg-surface px-4 py-3">
                <p className="break-words text-sm font-medium">
                  {pr.title}{" "}
                  <a
                    href={task.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap font-mono text-xs text-muted underline underline-offset-4"
                  >
                    #{pr.number} ↗
                  </a>
                </p>
                <p className="mt-1 truncate font-mono text-xs text-muted">
                  {pr.headRef} → {pr.baseRef}
                </p>
                <p className="mt-1 font-mono text-xs">
                  <span className="text-ok">+{pr.additions}</span>{" "}
                  <span className="text-blood">−{pr.deletions}</span>{" "}
                  <span className="text-muted">
                    · {pr.changedFiles}{" "}
                    {pr.changedFiles === 1 ? "file" : "files"}
                  </span>
                </p>
                {pr.body && (
                  // agent artifacts (Cursor screenshots) live in here as markdown images
                  <Markdownish
                    text={pr.body}
                    className="mt-2 max-h-80 overflow-y-auto text-xs text-muted"
                  />
                )}
              </div>

              <div className="mb-3 flex flex-col gap-2">
                {pr.files.map((f) => (
                  <FileDiff key={f.filename} file={f} />
                ))}
              </div>

              {pr.state === "open" && (
                <>
                  <Button
                    variant="ok"
                    onClick={() => setConfirming(true)}
                    disabled={mergeMutation.isPending}
                    className="flex w-full items-center justify-center gap-2"
                  >
                    <Icon name="merge" className="size-4" />
                    {mergeMutation.isPending ? "Merging…" : "Merge"}
                  </Button>
                  {mergeMutation.error && (
                    <ErrorText className="mt-2">
                      {mergeMutation.error.message}
                    </ErrorText>
                  )}
                </>
              )}
              {pr.state === "merged" && (
                <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-ok">
                  <Icon name="merge" className="size-3" />
                  Merged
                </p>
              )}
            </>
          )}
        </>
      )}

      {confirming && (
        <OverlayDialog placement="bottom" onClose={() => setConfirming(false)}>
          {({ requestClose }) => (
            <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
              <p className="mb-1 text-lg font-medium">Execute the merge?</p>
              <p className="mb-4 font-mono text-xs text-muted">
                Squash-merges {pr ? `#${pr.number}` : "the PR"} into{" "}
                {pr?.baseRef ?? "the base branch"}.
              </p>
              <Button
                variant="ok"
                onClick={() => {
                  mergeMutation.mutate();
                  requestClose();
                }}
                className="mb-2 flex w-full items-center justify-center gap-2"
              >
                <Icon name="merge" className="size-4" />
                Merge
              </Button>
              <Button
                variant="outline"
                onClick={requestClose}
                className="w-full"
              >
                Stand down
              </Button>
            </div>
          )}
        </OverlayDialog>
      )}
    </section>
  );
}

/** Deployment state dot: green live, red broken, amber still building. */
function deployDotClass(state: string): string {
  if (state === "success") return "bg-ok";
  if (state === "failure" || state === "error") return "bg-blood";
  if (state === "inactive") return "bg-muted";
  return "bg-warn animate-pulse motion-reduce:animate-none";
}

/**
 * Preview builds for the PR's branch, so a mark can be tested from the phone.
 * Falls back to the `previewUrl` the task poll stores when the PR read has no
 * deployments (no PR yet, or Deployments access not granted).
 */
function Deployments({
  task,
  deployments,
}: {
  task: Task;
  deployments?: Deployment[];
}) {
  const rows = deployments?.length
    ? deployments
    : task.previewUrl
      ? [{ environment: "Preview", state: "success", url: task.previewUrl }]
      : [];

  return (
    <>
      <FieldLabel as="h2" className="mb-2">
        Deployments
      </FieldLabel>
      {rows.length === 0 ? (
        <p className="mb-4 font-mono text-xs text-muted">
          No deployment yet — it appears once a preview build finishes.
        </p>
      ) : (
        <div className="mb-4 flex flex-col gap-2">
          {rows.map((d, i) => (
            <div
              key={`${d.environment}-${i}`}
              className="rounded-xl border border-edge bg-surface px-4 py-3"
            >
              <p className="flex items-center gap-2 font-mono text-xs">
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${deployDotClass(d.state)}`}
                />
                <span className="min-w-0 flex-1 truncate">{d.environment}</span>
                <span className="shrink-0 text-muted">
                  {d.state.replace("_", " ")}
                </span>
              </p>
              {d.url && (
                <Button
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  className="mt-2 flex w-full items-center justify-center gap-2 active:bg-background"
                >
                  Open preview
                  <Icon name="external" className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** +/− line coloring by first char — no diff library. */
function diffLineClass(line: string): string {
  if (line.startsWith("+")) return "bg-ok/10 text-ok";
  if (line.startsWith("-")) return "bg-blood/10 text-blood";
  if (line.startsWith("@@")) return "text-info";
  return "text-muted";
}

function FileDiff({ file }: { file: PrFile }) {
  return (
    <details className="overflow-hidden rounded-xl border border-edge bg-surface">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-mono text-xs active:bg-background">
        <span className="min-w-0 flex-1 truncate" dir="rtl">
          &lrm;{file.filename}
        </span>
        <span className="shrink-0">
          <span className="text-ok">+{file.additions}</span>{" "}
          <span className="text-blood">−{file.deletions}</span>
        </span>
      </summary>
      {file.patch ? (
        <pre className="overflow-x-auto border-t border-edge p-3 font-mono text-xs leading-relaxed">
          {file.patch.split("\n").map((line, i) => (
            <div key={i} className={`px-1 ${diffLineClass(line)}`}>
              {line || " "}
            </div>
          ))}
        </pre>
      ) : (
        <p className="border-t border-edge p-3 font-mono text-xs text-muted">
          {file.status} — binary or too large to diff
        </p>
      )}
    </details>
  );
}
