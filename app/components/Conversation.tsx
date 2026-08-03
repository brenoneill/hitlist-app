"use client";

import { useState } from "react";
import type { PrDetails } from "@/app/lib/githubApp";
import { cleanPrBody, extractImages } from "@/app/lib/markdownish";
import type { Task } from "@/app/lib/tasks";
import {
  usePrDetails,
  useSendMessage,
  useTaskMessages,
} from "@/app/lib/queries";
import { PROVIDER_META } from "@/app/lib/providerMeta";
import { Button } from "@/app/components/Button";
import { Icon, type IconName } from "@/app/components/Icons";
import { isGithubHost, PR_STATE } from "@/app/components/PrTab";
import { wasDeployed } from "@/app/components/TaskItem";
import { Chip } from "@/app/components/ui/Chip";
import { ErrorText } from "@/app/components/ui/ErrorText";
import { Markdownish } from "@/app/components/ui/Markdownish";
import { Textarea } from "@/app/components/ui/Textarea";

interface ShownMessage {
  id: string;
  role: "user" | "agent";
  body: string;
  createdAt?: string;
}

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
      items.push({
        key: "pr-open",
        kind: "event",
        icon: "pr",
        label: pr
          ? `PR ${pr.draft ? "drafted" : "opened"} #${pr.number}`
          : "PR opened",
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
  const { data: messages } = useTaskMessages(task.id, running);
  const { data: pr } = usePrDetails(task.id, !!task.prUrl);
  const sendMessage = useSendMessage(task.id);
  const supportsFollowups =
    !!task.provider && PROVIDER_META[task.provider].supportsFollowups;

  // pre-feature dispatches have no stored turns — synthesize the prompt from the
  // task; the run summary has its own home in the PR tab
  const shown: ShownMessage[] = messages?.length
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
        {buildTimeline(task, shown, pr).map((item) =>
          item.kind === "message" ? (
            <div
              key={item.key}
              className={`max-w-[88%] rounded-xl border px-4 py-3 text-sm ${
                item.msg.role === "user"
                  ? "self-end border-blood/30 bg-blood/10"
                  : "self-start border-edge bg-surface text-muted"
              }`}
            >
              <Markdownish text={item.msg.body} />
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
              {item.key === "pr-open" && task.prUrl && (
                <a
                  href={task.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open PR on GitHub"
                  className="ml-1 inline-flex align-middle text-muted/60 hover:text-muted"
                >
                  <Icon name="external" className="size-3" />
                </a>
              )}
            </Chip>
          ) : (
            <PrCard key={item.key} pr={pr} task={task} onShowPr={onShowPr} />
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
          {task.agentUrl && (
            <p className="mb-2">
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

/** The task's own preview build, or the first successful one GitHub reports for the PR. */
function previewHref(task: Task, pr: PrDetails): string | undefined {
  return pr.deployments?.find((d) => d.state === "success" && d.url)?.url ?? task.previewUrl;
}

/** Compact inline summary of the task's PR; full description and diffs stay in the PR tab. */
function PrCard({
  pr,
  task,
  onShowPr,
}: {
  pr: PrDetails | undefined;
  task: Task;
  onShowPr: () => void;
}) {
  if (!pr) return null;
  const preview = previewHref(task, pr);
  const shot = extractImages(
    pr.body ? cleanPrBody(pr.body) : undefined,
    task.agentSummary,
  )[0];
  return (
    <div className="self-stretch rounded-xl border border-edge bg-surface px-4 py-3">
      <p className="break-words text-sm font-medium">
        {pr.title} <span className="font-mono text-xs text-muted">#{pr.number}</span>
      </p>
      <p className="mt-1 font-mono text-xs">
        <span
          className={`uppercase tracking-widest ${
            pr.draft ? "text-warn" : PR_STATE[pr.state]
          }`}
        >
          {pr.draft ? "draft" : pr.state}
        </span>{" "}
        <span className="text-ok">+{pr.additions}</span>{" "}
        <span className="text-blood">−{pr.deletions}</span>{" "}
        <span className="text-muted">
          · {pr.changedFiles} {pr.changedFiles === 1 ? "file" : "files"}
        </span>
      </p>
      {shot && (
        <PrCardThumb
          src={
            isGithubHost(shot.url)
              ? `/api/tasks/${task.id}/pr/image?url=${encodeURIComponent(shot.url)}`
              : shot.url
          }
          alt={shot.alt}
        />
      )}
      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          onClick={onShowPr}
          className="flex flex-1 items-center justify-center gap-2 active:bg-background"
        >
          View PR
          <Icon name="pr" className="size-4" />
        </Button>
        {preview && (
          <Button
            href={preview}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            className="flex flex-1 items-center justify-center gap-2 active:bg-background"
          >
            Preview
            <Icon name="external" className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** ScreenshotThumb minus the lightbox — hides itself if the asset 404s. */
function PrCardThumb({ src, alt }: { src: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? "PR screenshot"}
      loading="lazy"
      onError={() => setFailed(true)}
      className="mt-2 h-24 w-auto max-w-full rounded-lg border border-edge object-cover"
    />
  );
}
