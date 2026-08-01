"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { Repo } from "@/app/components/GithubRepos";
import type { CursorModel } from "@/app/lib/cursor";
import { normalizeGroups } from "@/app/lib/groups";
import type { ProviderId } from "@/app/lib/providerMeta";
import type {
  PrOptionId,
  VisualConfirmationId,
} from "@/app/lib/prOptions";
import type { Task, TaskStatus } from "@/app/lib/tasks";

/** Deploy defaults returned by `/api/settings/defaults`. */
export type DeployDefaults = {
  provider: ProviderId | null;
  model: string | null;
  visualConfirmation: VisualConfirmationId;
};

const TASKS = ["tasks"];
const MODELS = ["models"]; // prefix — per-provider keys are ["models", provider]
const REPOS = ["repos"];
const PROVIDER_KEYS = ["provider-keys"];
const REPO_NOTES = ["repo-notes"]; // prefix — per-repo keys are ["repo-notes", url]
const DEPLOY_DEFAULTS = ["deploy-defaults"];

/** Fetch + unwrap; non-2xx throws the API's `error` so mutations can show it. */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  // DELETE answers 204 with no body
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return body as T;
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined
    ? {}
    : {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
});

/** Folds server-returned task(s) back into the cached list. */
function merge(qc: QueryClient, updated: Task | Task[]) {
  const next = [updated].flat();
  qc.setQueryData<Task[]>(TASKS, (prev) =>
    prev?.map((t) => next.find((u) => u.id === t.id) ?? t),
  );
}

/**
 * Optimistic list write with rollback — spread into a useMutation config.
 * Cancels in-flight polls first so a stale response can't undo the write.
 */
function optimistic<V>(qc: QueryClient, next: (prev: Task[], vars: V) => Task[]) {
  return {
    onMutate: async (vars: V) => {
      await qc.cancelQueries({ queryKey: TASKS });
      const prev = qc.getQueryData<Task[]>(TASKS) ?? [];
      qc.setQueryData<Task[]>(TASKS, next(prev, vars));
      return { prev };
    },
    onError: (_e: Error, _v: V, ctx?: { prev: Task[] }) => {
      if (ctx) qc.setQueryData(TASKS, ctx.prev);
    },
  };
}

/**
 * The task list. Polls while an agent is out (10s), while a finished run still
 * lacks its PR url (10s — Copilot often reports the branch first), or while a
 * PR is still open (60s). Stops once every PR is linked and merged/closed.
 * `paused` holds it off during a drag so a refetch can't clobber the reorder.
 */
export function useTasks(paused = false) {
  return useQuery({
    queryKey: TASKS,
    queryFn: () => api<Task[]>("/api/tasks"),
    refetchInterval: (q) => {
      if (paused) return false;
      const tasks = q.state.data ?? [];
      if (tasks.some((t) => t.status === "running")) return 10_000;
      // branch landed, PR url hasn't — keep refresh so discovery can fill it in
      const awaitingPr = tasks.some(
        (t) =>
          !!t.agentId &&
          !!t.branch &&
          !t.prUrl &&
          t.status !== "done" &&
          t.status !== "failed",
      );
      if (awaitingPr) return 10_000;
      const openPr = tasks.some(
        (t) => t.prUrl && (t.prState ?? "open") === "open",
      );
      return openPr ? 60_000 : false;
    },
  });
}

export function useAddTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { title: string; repoUrl?: string; details?: string }) =>
      api<Task>("/api/tasks", send("POST", v)),
    // the server unshifts, so a new mark lands on top
    onSuccess: (task) =>
      qc.setQueryData<Task[]>(TASKS, (prev) => [task, ...(prev ?? [])]),
  });
}

export function useRemoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/tasks/${id}`, send("DELETE")),
    ...optimistic<string>(qc, (prev, id) =>
      normalizeGroups(prev.filter((t) => t.id !== id)),
    ),
  });
}

const flipDone = (t: Task): TaskStatus => (t.status === "done" ? "inbox" : "done");

export function useToggleDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: Task) =>
      api<Task>(`/api/tasks/${task.id}`, send("PATCH", { status: flipDone(task) })),
    ...optimistic<Task>(qc, (prev, task) => {
      const status = flipDone(task);
      // mirrors the server's stamp so the done list sorts right before the response
      const doneAt = status === "done" ? new Date().toISOString() : task.doneAt;
      return prev.map((t) => (t.id === task.id ? { ...t, status, doneAt } : t));
    }),
    onSuccess: (task) => merge(qc, task),
  });
}

/** Persists a whole new order/grouping; the server returns the normalized list. */
export function useReorderTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (next: Task[]) =>
      api<Task[]>(
        "/api/tasks",
        send("PUT", {
          order: next.map((t) => ({ id: t.id, groupId: t.groupId ?? null })),
        }),
      ),
    ...optimistic<Task[]>(qc, (_prev, next) => next),
    onSuccess: (tasks) => qc.setQueryData<Task[]>(TASKS, tasks),
  });
}

export type TaskPatch = {
  id: string;
  title?: string;
  details?: string;
  repoUrl?: string | null;
  imageUrls?: string[];
};

export function usePatchTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: TaskPatch) =>
      api<Task>(`/api/tasks/${id}`, send("PATCH", patch)),
    onSuccess: (task) => merge(qc, task),
  });
}

/** Dispatching a grouped task dispatches — and returns — its whole group. */
export function useDispatchTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      provider?: ProviderId;
      model?: string;
      options?: PrOptionId[];
      /** Replace an existing agent with a fresh run. */
      redeploy?: boolean;
    }) => api<Task | Task[]>(`/api/tasks/${id}/dispatch`, send("POST", body)),
    onSuccess: (updated) => merge(qc, updated),
  });
}

export function useRepos(enabled: boolean) {
  return useQuery({
    queryKey: REPOS,
    // a failure here reads as "not connected" rather than an error state
    queryFn: async (): Promise<{ connected: boolean; repos: Repo[] }> => {
      const res = await fetch("/api/github/repos");
      return res.ok ? res.json() : { connected: false, repos: [] };
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useModels(provider: ProviderId | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...MODELS, provider],
    queryFn: () => api<CursorModel[]>(`/api/models?provider=${provider}`),
    enabled: enabled && !!provider,
    // fixed list per key; only a key change invalidates it
    staleTime: Infinity,
    retry: false,
  });
}

/** Per-repo agent access notes (plain text, injected into dispatch prompts). */
export function useRepoNotes(repoUrl: string) {
  return useQuery({
    queryKey: [...REPO_NOTES, repoUrl],
    queryFn: () =>
      api<{ notes: string }>(
        `/api/settings/repo-notes?repo=${encodeURIComponent(repoUrl)}`,
      ),
  });
}

export function useSaveRepoNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { repoUrl: string; notes: string }) =>
      api<{ notes: string }>("/api/settings/repo-notes", send("PUT", v)),
    onSuccess: (data, v) => {
      qc.setQueryData([...REPO_NOTES, v.repoUrl], data);
      // keep the repo list's "notes set" dot in step without re-hitting GitHub
      qc.setQueryData<{ connected: boolean; repos: Repo[] }>(REPOS, (prev) =>
        prev && {
          ...prev,
          repos: prev.repos.map((r) =>
            r.url === v.repoUrl ? { ...r, hasNotes: !!data.notes } : r,
          ),
        },
      );
    },
  });
}

export type ProviderKeyFlags = Record<ProviderId, boolean>;

export function useProviderKeys(enabled = true) {
  return useQuery({
    queryKey: PROVIDER_KEYS,
    queryFn: () => api<ProviderKeyFlags>("/api/settings/keys"),
    enabled,
  });
}

/** Shared onSuccess: a key change alters which models/runs the server can see. */
function invalidateKeyDependents(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: PROVIDER_KEYS });
  qc.invalidateQueries({ queryKey: MODELS }); // prefix match hits every provider
  qc.invalidateQueries({ queryKey: TASKS });
}

export function useSaveProviderKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, key }: { provider: ProviderId; key: string }) =>
      api<{ hasKey: boolean }>(
        `/api/settings/keys/${provider}`,
        send("POST", { key }),
      ),
    onSuccess: () => invalidateKeyDependents(qc),
  });
}

export function useClearProviderKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: ProviderId) =>
      api<{ hasKey: boolean }>(`/api/settings/keys/${provider}`, send("DELETE")),
    onSuccess: () => invalidateKeyDependents(qc),
  });
}

/** User's deploy defaults (provider, model, visual confirmation). */
export function useDeployDefaults(enabled = true) {
  return useQuery({
    queryKey: DEPLOY_DEFAULTS,
    queryFn: () => api<DeployDefaults>("/api/settings/defaults"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * Persists deploy defaults (partial patch).
 * Optimistic so Settings and open sheets stay in sync immediately.
 */
export function useSaveDeployDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: {
      provider?: ProviderId | null;
      model?: string | null;
      visualConfirmation?: VisualConfirmationId;
    }) => api<DeployDefaults>("/api/settings/defaults", send("PUT", patch)),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: DEPLOY_DEFAULTS });
      const prev = qc.getQueryData<DeployDefaults>(DEPLOY_DEFAULTS);
      if (prev) {
        const next: DeployDefaults = {
          provider:
            patch.provider !== undefined ? patch.provider : prev.provider,
          model: patch.model !== undefined ? patch.model : prev.model,
          visualConfirmation:
            patch.visualConfirmation !== undefined
              ? patch.visualConfirmation
              : prev.visualConfirmation,
        };
        if (
          patch.provider !== undefined &&
          patch.provider !== prev.provider &&
          patch.model === undefined
        ) {
          next.model = null;
        }
        qc.setQueryData(DEPLOY_DEFAULTS, next);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(DEPLOY_DEFAULTS, ctx.prev);
    },
    onSuccess: (data) => qc.setQueryData(DEPLOY_DEFAULTS, data),
  });
}
