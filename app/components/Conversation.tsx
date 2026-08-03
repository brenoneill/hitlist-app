"use client";

import { useState } from "react";
import type { PrDetails } from "@/app/lib/githubApp";
import type { Task } from "@/app/lib/tasks";
import {
  usePrDetails,
  useSendMessage,
  useTaskMessages,
} from "@/app/lib/queries";
import { PROVIDER_META } from "@/app/lib/providerMeta";
import { Button } from "@/app/components/Button";
import { Icon, type IconName } from "@/app/components/Icons";
import { PR_STATE } from "@/app/components/PrTab";
import { wasDeployed } from "@/app/components/TaskItem";
import { Chip } from "@/app/components/ui/Chip";
import { ErrorText } from "@/app/components/ui/ErrorText";
import { Markdownish } from "@/app/components/ui/Markdownish";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { Textarea } from "@/app/components/ui/Textarea";

interface ShownMessage {
  id: string;
  role: "user" | "agent";
  body: string;
  createdAt?: string;
  /** Placeholder turn held while the real transcript loads. */
  pending?: true;
}

/**
 * Stand-in turns so the timeline's chips and PR card render in their final
 * positions on the first paint — otherwise a one-bubble guess is replaced by
 * the real N turns and everything below it lurches.
 */
const LOADING_TURNS: ShownMessage[] = [
  { id: "pending-user", role: "user", body: "", pending: true },
  { id: "pending-agent", role: "agent", body: "", pending: true },
];

type TimelineItem =
  | { key: string; kind: "message"; msg: ShownMessage }
  | {
      key: string;
      kind: "event";
      icon: IconName;
      label: string;
      iso?: string;
      cls: string;
    }
  | { key: string; kind: "pr" };

/**
 * `shown` arrives in DB `created_at` order, which isn't trustworthy: Cursor
 * stamps a run's `createdAt` when the run *starts*, before our server even
 * finishes storing the prompt that triggered it, so a reply can sort ahead of
 * its own prompt. Timestamps *within* a role stay reliable (our server clock
 * orders prompts against each other; Cursor's clock orders runs against each
 * other, and a follow-up is never sent until the previous run is confirmed
 * done) — only prompt-vs-its-own-reply is skewed. Pairing corrects that
 * without comparing across clocks at all.
 */
function pairMessages(shown: ShownMessage[]): ShownMessage[] {
  const users = shown.filter((m) => m.role === "user");
  const agents = shown.filter((m) => m.role === "agent");
  const paired: ShownMessage[] = [];
  for (let i = 0; i < Math.max(users.length, agents.length); i++) {
    if (users[i]) paired.push(users[i]);
    if (agents[i]) paired.push(agents[i]);
  }
  return paired;
}

/**
 * Messages plus derived lifecycle events (dispatched, PR opened, merged…) in
 * one list, ordered by POSITION rather than timestamp comparison — see
 * `pairMessages` for why message order itself can't trust raw timestamps
 * either. Dispatch + PR-open always belong right after the prompt and before
 * the reply that describes them (Cursor drafts the PR at agent creation, so
 * it's always part of the first run); terminal events (merged/closed/failed)
 * always belong at the end.
 */
function buildTimeline(
  task: Task,
  shownRaw: ShownMessage[],
  pr: PrDetails | undefined,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  const shown = pairMessages(shownRaw);
  const firstAgentIndex = shown.findIndex((m) => m.role === "agent");
  const lifecycleAt = firstAgentIndex === -1 ? shown.length : firstAgentIndex;

  function pushLifecycleStart() {
    if (task.dispatchedAt && task.provider) {
      const meta = PROVIDER_META[task.provider];
      items.push({
        key: "dispatched",
        kind: "event",
        icon: meta.icon,
        label: `Dispatched to ${meta.label}`,
        iso: task.dispatchedAt,
        cls: "text-muted",
      });
    }
    if (task.prUrl) {
      // the number is already in the url — read it there rather than waiting on
      // the pr fetch, so the chip doesn't grow a `#123` after the fact
      const number = pr?.number ?? task.prUrl.match(/\/pull\/(\d+)/)?.[1];
      items.push({
        key: "pr-open",
        kind: "event",
        icon: "pr",
        label: `PR ${pr?.draft ? "drafted" : "opened"}${number ? ` #${number}` : ""}`,
        iso: pr?.createdAt,
        cls: "text-info",
      });
      items.push({ key: "pr-card", kind: "pr" });
    }
  }

  shown.forEach((m, i) => {
    if (i === lifecycleAt) pushLifecycleStart();
    items.push({ key: m.id, kind: "message", msg: m });
  });
  if (lifecycleAt === shown.length) pushLifecycleStart();

  const merged =
    !!task.mergedAt || pr?.state === "merged" || task.prState === "merged";
  if (merged) {
    items.push({
      key: "merged",
      kind: "event",
      icon: "merge",
      label: "Merged",
      iso: task.mergedAt ?? pr?.mergedAt,
      cls: "text-ok",
    });
  } else if (pr?.state === "closed" || task.prState === "closed") {
    items.push({
      key: "closed",
      kind: "event",
      icon: "x",
      label: "PR closed",
      cls: "text-muted",
    });
  }
  if (task.status === "failed") {
    items.push({
      key: "failed",
      kind: "event",
      icon: "ban",
      label: "Failed",
      cls: "text-blood",
    });
  }
  return items;
}

/** "3:42 PM" for today, "Aug 2, 3:42 PM" otherwise. */
function when(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

/** The Agent tab: conversation bubbles interleaved with lifecycle event chips. */
export function Conversation({
  task,
  onShowPr,
}: {
  task: Task;
  onShowPr: () => void;
}) {
  const [draft, setDraft] = useState("");
  const running = task.status === "running";
  const { data: messages, isLoading: messagesLoading } = useTaskMessages(
    task.id,
    running,
  );
  const { data: pr } = usePrDetails(task.id, !!task.prUrl);
  const sendMessage = useSendMessage(task.id);
  const supportsFollowups =
    !!task.provider && PROVIDER_META[task.provider].supportsFollowups;

  // pre-feature dispatches have no stored turns — synthesize the prompt from the
  // task; the run summary has its own home in the PR tab
  const shown: ShownMessage[] = messages?.length
    ? messages
    : messagesLoading
      ? LOADING_TURNS
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
        {buildTimeline(task, shown, pr).map((item) =>
          item.kind === "message" ? (
            <div
              key={item.key}
              className={`max-w-[88%] rounded-xl border px-4 py-3 text-sm ${
                item.msg.role === "user"
                  ? "self-end border-blood/30 bg-blood/10"
                  : "self-start border-edge bg-surface text-muted"
              } ${item.msg.pending ? "w-[70%]" : ""}`}
            >
              {item.msg.pending && (
                <>
                  <Skeleton className="h-4 rounded bg-edge" />
                  <Skeleton className="mt-2 h-4 w-2/3 rounded bg-edge" />
                </>
              )}
              {!item.msg.pending && <Markdownish text={item.msg.body} />}
              {item.msg.createdAt && (
                <p
                  className={`mt-1.5 font-mono text-[10px] text-muted/70 ${
                    item.msg.role === "user" ? "text-right" : ""
                  }`}
                >
                  {when(item.msg.createdAt)}
                </p>
              )}
            </div>
          ) : item.kind === "event" ? (
            <Chip
              key={item.key}
              variant="surface"
              icon={item.icon}
              iconClassName={`size-3 ${item.cls}`}
              className="self-center text-muted"
            >
              {item.label}
              {item.iso && (
                <span className="text-muted/60"> · {when(item.iso)}</span>
              )}
            </Chip>
          ) : (
            <PrCard key={item.key} pr={pr} onShowPr={onShowPr} />
          ),
        )}
        {running && (
          <p className="self-start font-mono text-[11px] uppercase tracking-widest text-warn animate-pulse">
            Agent working…
          </p>
        )}
      </div>

      {supportsFollowups && task.agentId ? (
        <div className="mt-3">
          <div className="flex items-end gap-2">
            <Textarea
              variant="pill"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                running
                  ? "Agent is working — reply when it finishes"
                  : "Message the agent…"
              }
              disabled={running || sendMessage.isPending}
              aria-label="Follow-up for the agent"
            />
            <button
              type="button"
              onClick={send}
              disabled={running || sendMessage.isPending || !draft.trim()}
              aria-label="Send follow-up"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-info text-white shadow-[0_0_16px_rgba(220,38,38,0.4)] active:opacity-80 disabled:opacity-40 disabled:shadow-none"
            >
              <Icon name="send" className="size-5" />
            </button>
          </div>
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

/** Teaser for the task's PR; stats, screenshots, description and diffs live in the PR tab. */
function PrCard({
  pr,
  onShowPr,
}: {
  pr: PrDetails | undefined;
  onShowPr: () => void;
}) {
  // the pr read can't start until the task read unlocks it, so it always lands
  // second — hold the card's footprint instead of popping it into the timeline
  if (!pr) return <PrCardSkeleton />;
  return (
    <div className="self-stretch rounded-xl border border-edge bg-surface px-4 py-3">
      <p className="break-words text-sm font-medium">
        {pr.title} <span className="font-mono text-xs text-muted">#{pr.number}</span>
      </p>
      <p
        className={`mt-1 font-mono text-xs uppercase tracking-widest ${
          pr.draft ? "text-warn" : PR_STATE[pr.state]
        }`}
      >
        {pr.draft ? "draft" : pr.state}
      </p>
      <Button
        variant="outline"
        onClick={onShowPr}
        className="mt-3 flex w-full items-center justify-center gap-2 active:bg-background"
      >
        View PR
        <Icon name="pr" className="size-4" />
      </Button>
    </div>
  );
}

/** `PrCard`'s footprint, held while the pr read is in flight. */
function PrCardSkeleton() {
  return (
    <div
      aria-hidden
      className="self-stretch rounded-xl border border-edge bg-surface px-4 py-3"
    >
      <Skeleton className="h-5 w-3/4 rounded bg-edge" />
      <Skeleton className="mt-1 h-4 w-1/2 rounded bg-edge" />
      <Skeleton className="mt-3 h-[46px] rounded-xl bg-edge" />
    </div>
  );
}
