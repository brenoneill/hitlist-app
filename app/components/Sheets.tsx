"use client";

import { useRef, useState } from "react";
import type { Task } from "@/app/lib/tasks";
import type { Repo } from "@/app/components/GithubRepos";
import {
  useDeployDefaults,
  useDispatchTask,
  useModels,
  usePatchTask,
  useProviderKeys,
  useToggleDone,
  type TaskPatch,
} from "@/app/lib/queries";
import {
  LAST_PROVIDER_KEY,
  OFFERED_PROVIDER_IDS,
  pickDefaultProvider,
  type ProviderId,
} from "@/app/lib/providerMeta";
import {
  DEFAULT_VISUAL_CONFIRMATION,
  optionsForMode,
  type VisualConfirmationId,
} from "@/app/lib/prOptions";
import { deployDefaultsChips } from "@/app/lib/deployDefaultsLabel";
import { deployable } from "@/app/components/TaskItem";
import { Icon } from "@/app/components/Icons";
import { Button } from "@/app/components/Button";
import { ModelSelect } from "@/app/components/ModelSelect";
import { ProviderRadio } from "@/app/components/ProviderRadio";
import { VisualConfirmationRadio } from "@/app/components/VisualConfirmationRadio";
import { Chip } from "@/app/components/ui/Chip";
import { FieldLabel } from "@/app/components/ui/FieldLabel";
import { Menu, MenuItem } from "@/app/components/ui/Menu";
import { ErrorText } from "@/app/components/ui/ErrorText";
import { OverlayDialog } from "@/app/components/ui/OverlayDialog";
import { Textarea } from "@/app/components/ui/Textarea";

/** One-tap redeploy: Settings defaults (provider / model / visual). */
export function useQuickRedeploy() {
  const { data: keys } = useProviderKeys();
  const { data: defaults } = useDeployDefaults();
  const dispatch = useDispatchTask();
  function redeploy(id: string) {
    const provider = pickDefaultProvider(
      OFFERED_PROVIDER_IDS.filter((p) => keys?.[p]),
      defaults?.provider ??
        (typeof window === "undefined"
          ? null
          : localStorage.getItem(LAST_PROVIDER_KEY)),
    );
    if (provider) localStorage.setItem(LAST_PROVIDER_KEY, provider);
    dispatch.mutate({
      id,
      ...(provider ? { provider } : {}),
      ...(defaults?.model ? { model: defaults.model } : {}),
      ...(defaults?.visualConfirmation
        ? { options: optionsForMode(defaults.visualConfirmation) }
        : {}),
      redeploy: true,
    });
  }
  return { redeploy, pending: dispatch.isPending, error: dispatch.error };
}

/** Bottom sheet: sizes to content up to 92dvh, slides up on open / down on close. */
export function Sheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <OverlayDialog placement="bottom" onClose={onClose}>
      {({ bindHandle }) => (
        <>
          <div
            className="flex shrink-0 touch-none justify-center pt-3 pb-1"
            aria-hidden
            {...bindHandle}
          >
            <div className="h-1 w-10 rounded-full bg-edge" />
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
            {children}
          </div>
        </>
      )}
    </OverlayDialog>
  );
}

/** "4m" / "1h 12m" since the given ISO timestamp; each 10s poll re-renders it. */
export function elapsed(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * Shared sheet body: deploy settings + button + error. `children` render above
 * the settings (the details textarea in TaskSheet). Dispatching `lead`
 * dispatches its whole group.
 */
function AgentActions({
  lead,
  canDeploy,
  beforeSend,
  children,
}: {
  lead: Task;
  /** False when neither the task nor any group member has a repo tagged. */
  canDeploy: boolean;
  beforeSend?: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const { data: defaults } = useDeployDefaults();
  // null until the user overrides — tracks the Settings default as it loads
  const [modelOverride, setModelOverride] = useState<string | null>(null);
  const [visualOverride, setVisualOverride] =
    useState<VisualConfirmationId | null>(null);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const { data: keys } = useProviderKeys();
  const configured = OFFERED_PROVIDER_IDS.filter((p) => keys?.[p]);
  // derived, not seeded state — `keys` arrives async after the sheet opens
  const [chosen, setChosen] = useState<ProviderId | null>(null);
  const provider =
    chosen && configured.includes(chosen)
      ? chosen
      : pickDefaultProvider(
          configured,
          defaults?.provider ??
            (typeof window === "undefined"
              ? null
              : localStorage.getItem(LAST_PROVIDER_KEY)),
        );
  // cached for the session; only a provider key change invalidates the list
  const { data: models, isLoading: modelsLoading } = useModels(
    provider,
    deployable(lead),
  );
  const model = modelOverride ?? defaults?.model ?? "";
  const visualConfirmation =
    visualOverride ??
    defaults?.visualConfirmation ??
    DEFAULT_VISUAL_CONFIRMATION;
  // the response lands in the task cache — `lead` comes from there, so no callback
  const dispatch = useDispatchTask();
  const defaultsChips = deployDefaultsChips({
    provider,
    modelId: model || null,
    modelName: models?.find((m) => m.id === model)?.displayName,
    visualConfirmation,
    showProvider: configured.length > 1,
  });

  async function send() {
    await beforeSend?.();
    if (provider) localStorage.setItem(LAST_PROVIDER_KEY, provider);
    dispatch.mutate({
      id: lead.id,
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      options: optionsForMode(visualConfirmation),
    });
  }

  return (
    <>
      {children}

      {deployable(lead) && (
        <>
          <div className="mb-3 overflow-hidden rounded-xl border border-edge bg-background">
            <button
              type="button"
              onClick={() => setDefaultsOpen((o) => !o)}
              aria-expanded={defaultsOpen}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Settings</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {defaultsChips.map((chip) => (
                    <span key={chip.label} className="flex items-center gap-1.5">
                      <Icon name={chip.icon} className="size-3 shrink-0" />
                      {chip.label}
                    </span>
                  ))}
                </span>
              </span>
              <Icon
                name="chevron"
                className={`size-4 shrink-0 text-muted transition-transform ${
                  defaultsOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {defaultsOpen && (
              <div className="border-t border-edge px-4 py-3">
                <ProviderRadio
                  providers={configured}
                  value={provider}
                  onChange={(p) => {
                    setChosen(p);
                    setModelOverride(""); // model lists don't overlap across providers
                  }}
                  className="mb-3"
                />
                <ModelSelect
                  value={model}
                  onChange={setModelOverride}
                  models={models}
                  loading={modelsLoading}
                  className="mb-3"
                />
                <FieldLabel className="mb-2">Visual confirmation</FieldLabel>
                <VisualConfirmationRadio
                  value={visualConfirmation}
                  onChange={setVisualOverride}
                />
              </div>
            )}
          </div>
          <Button
            onClick={send}
            disabled={dispatch.isPending || !canDeploy}
            className="mb-3 w-full"
          >
            {dispatch.isPending
              ? "Dispatching…"
              : lead.groupId
                ? "Dispatch group"
                : "Dispatch agent"}
          </Button>
        </>
      )}

      {dispatch.error && (
        <ErrorText className="mb-3">
          {dispatch.error.message || "dispatch failed"}
        </ErrorText>
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
  const toggleDone = useToggleDone();
  const editable = deployable(task);
  const markExecuted = () => toggleDone.mutate(task);
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
            <FieldLabel className="mb-1">
              In a group · dispatches together
            </FieldLabel>
          )}
          {editable ? (
            <Textarea
              variant="ghost"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              rows={1}
              aria-label="Item name"
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
        <Menu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          className="right-0 top-8 min-w-40"
        >
          <MenuItem
            icon={task.status === "done" ? "x" : "check"}
            disabled={toggleDone.isPending}
            onClick={() => {
              setMenuOpen(false);
              markExecuted();
            }}
          >
            {task.status === "done" ? "Unmark" : "Mark executed"}
          </MenuItem>
          <MenuItem
            icon="trash"
            destructive
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
          >
            Delete
          </MenuItem>
        </Menu>
      </div>
      {editable && (
        <div className="mb-3">
          {task.repoUrl ? (
            <Chip
              icon="crosshair"
              onDismiss={() => tagRepo(null)}
              dismissLabel="Remove repo"
            >
              <span className="truncate">{tagged?.name ?? task.repoUrl}</span>
            </Chip>
          ) : (
            <div className="relative">
              <Chip
                variant="muted"
                icon="crosshair"
                onClick={() => setPickingRepo((o) => !o)}
              >
                Tag a repo
              </Chip>
              <Menu
                open={pickingRepo}
                onClose={() => setPickingRepo(false)}
                className="inset-x-0 top-full mt-1"
              >
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
              </Menu>
            </div>
          )}
        </div>
      )}
      <AgentActions lead={task} canDeploy={canDeploy} beforeSend={saveDetails}>
        {editable ? (
          <>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              onBlur={saveDetails}
              placeholder="Context for the agent — optional"
              rows={3}
              className="mb-3"
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
              <Chip
                variant="muted"
                icon="image"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="mb-3"
              >
                {uploading ? "Uploading…" : "Add screenshot"}
              </Chip>
            )}
            {(task.imageUrls?.length ?? 0) > 0 && (
              <p className="mb-3 mt-2 font-mono text-xs text-warn">
                Screenshots upload to a public host so the agent can read them —
                anyone with the link can view them. Nothing sensitive. Deleted
                when the PR merges or you remove them.
              </p>
            )}
            {uploadError && (
              <ErrorText className="mb-3">{uploadError}</ErrorText>
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
        <FieldLabel className="min-w-0 flex-1">
          Grouped hit · {members.length} marks
        </FieldLabel>
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
          <MenuItem
            icon="x"
            destructive
            onClick={() => {
              setMenuOpen(false);
              onDisband();
            }}
          >
            Disband group
          </MenuItem>
        </Menu>
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
