"use client";

import { useRef, useState } from "react";
import type { Task } from "@/app/lib/tasks";
import type { Repo } from "@/app/components/GithubRepos";
import {
  useDispatchTask,
  useModels,
  usePatchTask,
  type TaskPatch,
} from "@/app/lib/queries";
import {
  DEFAULT_PR_OPTIONS,
  PR_OPTIONS,
  type PrOptionId,
} from "@/app/lib/prOptions";
import { StatusBadge, deployable, prIcon } from "@/app/components/TaskList";
import { BLOOD_BUTTON, Icon } from "@/app/components/Icons";

/** Bottom sheet: sizes to content up to 92dvh, slides up on open / down on close. */
function Sheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);

  // Closing slides from wherever the sheet currently sits (dragged or resting),
  // so it's an inline transition rather than a keyframe replay from the top.
  function requestClose() {
    if (closing) return;
    const el = sheetRef.current;
    if (el) {
      el.style.transition = "transform 0.28s cubic-bezier(0.4, 0, 0.68, 0.28)";
      el.style.transform = "translateY(100%)";
    }
    setClosing(true);
  }

  function onHandlePointerDown(e: React.PointerEvent) {
    if (closing) return;
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = sheetRef.current;
    if (el) el.style.transition = "none";
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (startY.current == null || closing) return;
    const el = sheetRef.current;
    if (el)
      el.style.transform = `translateY(${Math.max(0, e.clientY - startY.current)}px)`;
  }

  function onHandlePointerUp(e: React.PointerEvent) {
    if (startY.current == null || closing) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    if (dy > 80) {
      requestClose();
      return;
    }
    const el = sheetRef.current;
    if (el) {
      el.style.transition = "transform 0.2s ease-out";
      el.style.transform = "";
    }
  }

  return (
    <div
      className={`fixed inset-0 z-10 flex flex-col justify-end bg-black/60 ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={requestClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92dvh] animate-slide-up flex-col overflow-hidden rounded-t-2xl border-t border-edge bg-surface"
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={(e) => {
          if (!closing) return;
          if (e.target !== e.currentTarget) return;
          if (e.propertyName !== "transform") return;
          onClose();
        }}
      >
        <div
          className="flex shrink-0 touch-none justify-center pt-3 pb-1"
          aria-hidden
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <div className="h-1 w-10 rounded-full bg-edge" />
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          {children}
        </div>
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
  hideRepo,
  beforeSend,
  children,
}: {
  lead: Task;
  /** False when neither the task nor any group member has a repo tagged. */
  canDeploy: boolean;
  /** When the parent sheet owns an editable repo chip. */
  hideRepo?: boolean;
  beforeSend?: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const [model, setModel] = useState("");
  const [options, setOptions] = useState<PrOptionId[]>(DEFAULT_PR_OPTIONS);
  // cached for the session; only a Cursor key change invalidates the list
  const { data: models, isLoading: modelsLoading } = useModels(deployable(lead));
  // the response lands in the task cache — `lead` comes from there, so no callback
  const dispatch = useDispatchTask();

  async function send() {
    await beforeSend?.();
    dispatch.mutate({
      id: lead.id,
      ...(model ? { model } : {}),
      options,
    });
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
        {!hideRepo && lead.repoUrl && (
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

      {lead.previewUrl && (
        <a
          href={lead.previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 font-mono text-sm font-bold uppercase tracking-widest text-foreground active:opacity-80"
        >
          <Icon name="external" className="size-4" />
          Open preview
        </a>
      )}

      {deployable(lead) && (
        <>
          {/* Reserve select height before /api/models resolves */}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={modelsLoading}
            aria-busy={modelsLoading}
            aria-label="Agent model"
            className="mb-3 h-[2.875rem] w-full rounded-xl border border-edge bg-background px-4 text-base outline-none focus:border-blood disabled:opacity-70"
          >
            <option value="">
              {!modelsLoading ? "Auto (default model)" : "Loading models…"}
            </option>
            {(models ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
          {PR_OPTIONS.map((o) => (
            <label
              key={o.id}
              className="mb-3 flex items-center gap-2 font-mono text-xs text-muted"
            >
              <input
                type="checkbox"
                checked={options.includes(o.id)}
                onChange={(e) =>
                  setOptions((prev) =>
                    e.target.checked
                      ? [...prev, o.id]
                      : prev.filter((id) => id !== o.id),
                  )
                }
                className="size-4 accent-blood"
              />
              {o.label}
            </label>
          ))}
          <button
            onClick={send}
            disabled={dispatch.isPending || !canDeploy}
            className={`${BLOOD_BUTTON} mb-3 w-full`}
          >
            {dispatch.isPending
              ? "Deploying…"
              : lead.groupId
                ? "Deploy group"
                : "Deploy agent"}
          </button>
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

      {dispatch.error && (
        <p className="mb-3 font-mono text-xs text-blood">
          {dispatch.error.message || "dispatch failed"}
        </p>
      )}
    </>
  );
}

export function TaskSheet({
  task,
  canDeploy,
  repos,
  onClose,
  onDelete,
}: {
  task: Task;
  /** From the page — the sheet can't see its group siblings' repos. */
  canDeploy: boolean;
  /** Pickable GitHub repos for post-create tagging. */
  repos: Repo[];
  onClose: () => void;
  onDelete: () => void;
}) {
  const [details, setDetails] = useState(task.details ?? "");
  const [title, setTitle] = useState(task.title);
  const [pickingRepo, setPickingRepo] = useState(false);
  const [repoFilter, setRepoFilter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const patchTask = usePatchTask();
  const editable = deployable(task);
  const tagged = repos.find((r) => r.url === task.repoUrl);
  const repoMatches = repos
    .filter((r) =>
      r.name.toLowerCase().includes(repoFilter.trim().toLowerCase()),
    )
    .slice(0, 8);

  /**
   * Awaitable (deploy saves details first); the updated task lands in the cache,
   * which re-renders this sheet. A rejected edit is swallowed — the field keeps
   * what you typed and the next blur retries.
   */
  function patch(body: Omit<TaskPatch, "id">) {
    return patchTask.mutateAsync({ id: task.id, ...body }).catch(() => {});
  }

  async function saveDetails() {
    if (details.trim() === (task.details ?? "")) return;
    await patch({ details });
  }

  async function saveTitle() {
    const next = title.trim();
    if (!next || next === task.title) {
      setTitle(task.title);
      return;
    }
    await patch({ title: next });
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setUploadError((body as { error?: string }).error ?? "upload failed");
      return;
    }
    await patch({
      imageUrls: [...(task.imageUrls ?? []), (body as { url: string }).url],
    });
  }

  async function tagRepo(url: string | null) {
    setPickingRepo(false);
    setRepoFilter("");
    if ((url ?? undefined) === task.repoUrl) return;
    await patch({ repoUrl: url });
  }

  return (
    <Sheet onClose={onClose}>
      <div className="relative mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {task.groupId && (
            <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted">
              In a group · deploys together
            </p>
          )}
          {editable ? (
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              rows={1}
              aria-label="Item name"
              className="field-sizing-content w-full resize-none overflow-hidden break-words rounded-xl border border-transparent bg-transparent px-0 py-0 text-lg font-medium outline-none focus:border-edge focus:bg-background focus:px-3 focus:py-2"
            />
          ) : (
            <p className="whitespace-pre-wrap break-words text-lg font-medium">
              {task.title}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="More actions"
          className="shrink-0 p-1 text-muted hover:text-foreground"
        >
          <Icon name="ellipsis" className="size-4" />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-8 z-20 min-w-40 overflow-hidden rounded-xl border border-edge bg-surface shadow-lg shadow-black/50">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-blood hover:bg-background"
              >
                <Icon name="trash" className="size-4" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
      {editable && (
        <div className="mb-3">
          {task.repoUrl ? (
            <span className="flex items-center gap-1.5 self-start rounded-full border border-edge bg-background px-3 py-1 font-mono text-xs">
              <Icon name="crosshair" className="size-3 text-blood" />
              <span className="truncate">{tagged?.name ?? task.repoUrl}</span>
              <button
                type="button"
                onClick={() => tagRepo(null)}
                aria-label="Remove repo"
              >
                <Icon name="x" className="size-3 text-muted" />
              </button>
            </span>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickingRepo((o) => !o)}
                className="flex items-center gap-1.5 rounded-full border border-edge bg-background px-3 py-1 font-mono text-xs text-muted active:opacity-80"
              >
                <Icon name="crosshair" className="size-3" />
                Tag a repo
              </button>
              {pickingRepo && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setPickingRepo(false)}
                  />
                  <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-edge bg-surface shadow-lg shadow-black/50">
                    <input
                      value={repoFilter}
                      onChange={(e) => setRepoFilter(e.target.value)}
                      placeholder="Filter repos…"
                      autoFocus
                      className="w-full border-b border-edge bg-transparent px-4 py-2.5 font-mono text-base outline-none placeholder:text-muted"
                    />
                    {repoMatches.length === 0 ? (
                      <p className="px-4 py-2.5 font-mono text-xs text-muted">
                        No repos
                      </p>
                    ) : (
                      repoMatches.map((r) => (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => tagRepo(r.url)}
                          className="block w-full truncate px-4 py-2.5 text-left font-mono text-sm active:bg-background"
                        >
                          {r.name}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <AgentActions
        lead={task}
        canDeploy={canDeploy}
        hideRepo={editable}
        beforeSend={saveDetails}
      >
        {editable ? (
          <>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              onBlur={saveDetails}
              placeholder="Context for the agent — optional"
              rows={3}
              className="mb-3 field-sizing-content min-h-[5.5rem] w-full resize-none overflow-hidden rounded-xl border border-edge bg-background px-4 py-3 text-base leading-normal outline-none placeholder:text-muted focus:border-blood"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) uploadImage(file);
              }}
            />
            {(task.imageUrls?.length ?? 0) > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {task.imageUrls!.map((url) => (
                  <span key={url} className="relative">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Attached screenshot"
                        className="h-16 w-16 rounded-lg border border-edge object-cover"
                      />
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          imageUrls: (task.imageUrls ?? []).filter(
                            (u) => u !== url,
                          ),
                        })
                      }
                      aria-label="Remove screenshot"
                      className="absolute -right-1.5 -top-1.5 rounded-full border border-edge bg-surface p-0.5"
                    >
                      <Icon name="x" className="size-3 text-muted" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Add another screenshot"
                  className="flex h-16 w-16 items-center justify-center rounded-lg border border-edge bg-background font-mono text-lg leading-none text-muted active:opacity-80 disabled:opacity-40"
                >
                  {uploading ? "…" : "+"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="mb-3 flex items-center gap-1.5 rounded-full border border-edge bg-background px-3 py-1 font-mono text-xs text-muted active:opacity-80 disabled:opacity-40"
              >
                <Icon name="image" className="size-3" />
                {uploading ? "Uploading…" : "Add screenshot"}
              </button>
            )}
            {(task.imageUrls?.length ?? 0) > 0 && (
              <p className="mb-3 mt-2 font-mono text-xs text-warn">
                Screenshots upload to a public temp host so the agent can read
                them — anyone with the link can view them. Nothing sensitive.
                Auto-deletes within 72h, so deploy soon after attaching.
              </p>
            )}
            {uploadError && (
              <p className="mb-3 font-mono text-xs text-blood">{uploadError}</p>
            )}
          </>
        ) : (
          <>
            {task.details && (
              <p className="mb-3 min-h-[5.5rem] whitespace-pre-wrap break-words rounded-xl border border-edge bg-background px-4 py-3 text-sm text-muted">
                {task.details}
              </p>
            )}
            {(task.imageUrls?.length ?? 0) > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {task.imageUrls!.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Attached screenshot"
                      className="h-16 rounded-lg border border-edge object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </AgentActions>
    </Sheet>
  );
}

export function GroupSheet({
  members,
  onClose,
  onEditMember,
  onDisband,
}: {
  members: Task[];
  onClose: () => void;
  /** Swaps this sheet for the member's own sheet, to edit its context. */
  onEditMember: (t: Task) => void;
  onDisband: () => void;
}) {
  const lead = members[0];
  const editable = deployable(lead);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <Sheet onClose={onClose}>
      <div className="relative mb-2 flex items-start gap-2">
        <p className="min-w-0 flex-1 font-mono text-[11px] uppercase tracking-widest text-muted">
          Grouped hit · {members.length} marks
        </p>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="More actions"
          className="shrink-0 p-1 text-muted hover:text-foreground"
        >
          <Icon name="ellipsis" className="size-4" />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-8 z-20 min-w-40 overflow-hidden rounded-xl border border-edge bg-surface shadow-lg shadow-black/50">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDisband();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-blood hover:bg-background"
              >
                <Icon name="x" className="size-4" />
                Disband group
              </button>
            </div>
          </>
        )}
      </div>
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
      <AgentActions lead={lead} canDeploy={members.some((m) => m.repoUrl)} />
    </Sheet>
  );
}
