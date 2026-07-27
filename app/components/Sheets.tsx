"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/app/lib/tasks";
import type { CursorModel } from "@/app/lib/cursor";
import { StatusBadge, deployable, prIcon } from "@/app/components/TaskList";
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

/** "4m" / "1h 12m" since the given ISO timestamp; each 10s poll re-renders it. */
function elapsed(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * Shared sheet body: status badge, run details, deploy button, PR/agent links,
 * error. `children` render between the status block and the deploy button (the
 * details textarea in TaskSheet). Dispatching `lead` dispatches its whole group.
 */
function AgentActions({
  lead,
  canDeploy,
  beforeSend,
  onDeployed,
  children,
}: {
  lead: Task;
  /** False when neither the task nor any group member has a repo tagged. */
  canDeploy: boolean;
  beforeSend?: () => Promise<void>;
  onDeployed: (body: unknown) => void;
  children?: React.ReactNode;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<CursorModel[]>([]);
  const [model, setModel] = useState("");

  useEffect(() => {
    if (!deployable(lead)) return;
    fetch("/api/models")
      .then((res) => (res.ok ? res.json() : []))
      .then(setModels)
      .catch(() => {});
    // deployable(lead) only flips false->true per sheet open, safe to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    setSending(true);
    setError(null);
    await beforeSend?.();
    const res = await fetch(`/api/tasks/${lead.id}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(model ? { model } : {}),
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
      <div className="mb-5 flex flex-col gap-1">
        <StatusBadge task={lead} />
        {lead.status === "running" && lead.dispatchedAt && (
          <p className="font-mono text-xs text-warn">
            Working for {elapsed(lead.dispatchedAt)}
          </p>
        )}
        {lead.repoUrl && (
          <p className="truncate font-mono text-xs text-muted">{lead.repoUrl}</p>
        )}
        {lead.branch && (
          <p className="truncate font-mono text-xs text-muted">
            <Icon name="pr" className="mr-1 inline size-3 align-[-2px]" />
            {lead.branch}
          </p>
        )}
      </div>

      {children}

      {lead.agentSummary && (
        <p className="mb-3 whitespace-pre-wrap break-words rounded-xl border border-edge bg-background px-4 py-3 text-sm text-muted">
          {lead.agentSummary}
        </p>
      )}

      {lead.prUrl && (
        <a
          href={lead.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={
            lead.status === "done"
              ? "mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ok py-3 font-mono text-sm font-bold uppercase tracking-widest text-black shadow-[0_0_16px_rgba(34,197,94,0.4)] active:opacity-80"
              : "mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-info py-3 font-mono text-sm font-bold uppercase tracking-widest text-white shadow-[0_0_16px_rgba(59,130,246,0.4)] active:opacity-80"
          }
        >
          <Icon name={prIcon(lead)} className="size-4" />
          {lead.prState === "merged" ? "View merged PR" : "Review PR"}
        </a>
      )}

      {deployable(lead) && (
        <>
          {models.length > 0 && (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mb-3 w-full rounded-xl border border-edge bg-background px-4 py-3 text-sm outline-none focus:border-blood"
            >
              <option value="">Auto (default model)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={send}
            disabled={sending || !canDeploy}
            className={`${BLOOD_BUTTON} mb-3 w-full`}
          >
            {sending
              ? "Deploying…"
              : lead.groupId
                ? "Deploy group"
                : "Deploy agent"}
          </button>
          {!canDeploy && (
            <p className="mb-3 text-center font-mono text-xs text-muted">
              Tag a repo to deploy
            </p>
          )}
        </>
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
  canDeploy,
  onClose,
  onDispatched,
  onDelete,
}: {
  task: Task;
  /** From the page — the sheet can't see its group siblings' repos. */
  canDeploy: boolean;
  onClose: () => void;
  /** Dispatching a grouped task returns every member. */
  onDispatched: (t: Task | Task[]) => void;
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
      {task.groupId && (
        <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted">
          In a group · deploys together
        </p>
      )}
      <p className="mb-2 break-words text-lg font-medium">{task.title}</p>
      <AgentActions
        lead={task}
        canDeploy={canDeploy}
        beforeSend={saveDetails}
        onDeployed={(body) => onDispatched(body as Task | Task[])}
      >
        {deployable(task) ? (
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
        className="flex w-full items-center justify-center gap-2 py-2 text-sm text-muted active:opacity-70"
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
  onEditMember,
  onDeployed,
  onDisband,
}: {
  members: Task[];
  onClose: () => void;
  /** Swaps this sheet for the member's own sheet, to edit its context. */
  onEditMember: (t: Task) => void;
  onDeployed: () => void;
  onDisband: () => void;
}) {
  const lead = members[0];
  const editable = deployable(lead);
  return (
    <Sheet onClose={onClose}>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">
        Grouped hit · {members.length} marks
      </p>
      <ul className="mb-2 flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.id}>
            <button
              onClick={() => onEditMember(m)}
              disabled={!editable && !m.details}
              className="flex w-full flex-col items-start gap-0.5 text-left"
            >
              <span className="break-words font-medium">– {m.title}</span>
              {/* context travels with the group prompt; press to edit it */}
              {(m.details || editable) && (
                <span className="whitespace-pre-wrap break-words pl-3 text-xs text-muted">
                  {m.details || "Add context…"}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <AgentActions
        lead={lead}
        canDeploy={members.some((m) => m.repoUrl)}
        onDeployed={() => onDeployed()}
      />
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
