"use client";

import { useState } from "react";
import type { Task } from "@/app/lib/tasks";
import { StatusBadge } from "@/app/components/TaskList";
import { BLOOD_BUTTON, Icon } from "@/app/components/Icons";

/** Bottom sheet: tap-outside closes, slides up on open. ponytail: no exit animation — needs the state to stay mounted; add if the snap-shut bugs you. */
function Sheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-10 flex animate-fade-in flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="animate-slide-up rounded-t-2xl border-t border-edge bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Shared sheet body: status badge, repo line, deploy button, agent link, error.
 * `children` render between the status block and the deploy button (the details
 * textarea in TaskSheet). Dispatching `lead` dispatches its whole group, if any.
 */
function AgentActions({
  lead,
  beforeSend,
  onDeployed,
  children,
}: {
  lead: Task;
  beforeSend?: () => Promise<void>;
  onDeployed: (body: unknown) => void;
  children?: React.ReactNode;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    await beforeSend?.();
    const res = await fetch(`/api/tasks/${lead.id}/dispatch`, {
      method: "POST",
    });
    const body = await res.json();
    setSending(false);
    if (!res.ok) {
      setError((body as { error?: string }).error ?? "dispatch failed");
      return;
    }
    onDeployed(body);
  }

  return (
    <>
      <div className="mb-1">
        <StatusBadge status={lead.status} />
      </div>
      {lead.repoUrl && (
        <p className="mb-5 truncate font-mono text-xs text-muted">
          {lead.repoUrl}
        </p>
      )}

      {children}

      {lead.status === "inbox" && (
        <button
          onClick={send}
          disabled={sending}
          className={`${BLOOD_BUTTON} mb-3 w-full`}
        >
          {sending ? "Deploying…" : "Deploy agent"}
        </button>
      )}

      {lead.agentUrl && (
        <a
          href={lead.agentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 font-mono text-sm font-bold uppercase tracking-widest active:bg-background"
        >
          View agent
          <Icon name="external" className="size-4" />
        </a>
      )}

      {error && <p className="mb-3 font-mono text-xs text-blood">{error}</p>}
    </>
  );
}

export function TaskSheet({
  task,
  onClose,
  onDispatched,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onDispatched: (t: Task) => void;
  onDelete: () => void;
}) {
  const [details, setDetails] = useState(task.details ?? "");

  async function saveDetails() {
    if (details.trim() === (task.details ?? "")) return;
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ details }),
    });
    if (res.ok) onDispatched(await res.json());
  }

  return (
    <Sheet onClose={onClose}>
      <p className="mb-2 break-words text-lg font-medium">{task.title}</p>
      <AgentActions
        lead={task}
        beforeSend={saveDetails}
        onDeployed={(body) => onDispatched(body as Task)}
      >
        {task.status === "inbox" ? (
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            onBlur={saveDetails}
            placeholder="Context for the agent — optional"
            rows={3}
            className="mb-3 w-full resize-none rounded-xl border border-edge bg-background px-4 py-3 text-base outline-none placeholder:text-muted focus:border-blood"
          />
        ) : (
          task.details && (
            <p className="mb-3 whitespace-pre-wrap break-words rounded-xl border border-edge bg-background px-4 py-3 text-sm text-muted">
              {task.details}
            </p>
          )
        )}
      </AgentActions>
      <button
        onClick={onDelete}
        className="flex w-full items-center justify-center gap-2 py-2 text-base text-blood active:opacity-70"
      >
        <Icon name="trash" className="size-4" />
        Delete
      </button>
    </Sheet>
  );
}

export function GroupSheet({
  members,
  onClose,
  onDeployed,
  onDisband,
}: {
  members: Task[];
  onClose: () => void;
  onDeployed: () => void;
  onDisband: () => void;
}) {
  const lead = members[0];
  return (
    <Sheet onClose={onClose}>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">
        Grouped hit · {members.length} marks
      </p>
      <ul className="mb-2 flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.id} className="break-words font-medium">
            – {m.title}
          </li>
        ))}
      </ul>
      <AgentActions lead={lead} onDeployed={() => onDeployed()} />
      <button
        onClick={onDisband}
        className="flex w-full items-center justify-center gap-2 py-2 text-base text-muted active:opacity-70"
      >
        <Icon name="x" className="size-4" />
        Disband group
      </button>
    </Sheet>
  );
}
