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
import type { PrOptionId } from "@/app/lib/prOptions";
import type { Task, TaskStatus } from "@/app/lib/tasks";

const TASKS = ["tasks"];
const MODELS = ["models"];
const REPOS = ["repos"];
const CURSOR_KEY = ["cursor-key"];

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
 * The task list. Polls only while an agent is out (10s) or a PR is still open
 * (60s — merges aren't urgent and every check costs a GitHub call); stops dead
 * once every PR is merged/closed. `paused` holds it off during a drag so a
 * refetch can't clobber the reorder in flight.
 */
export function useTasks(paused = false) {
  return useQuery({
    queryKey: TASKS,
    queryFn: () => api<Task[]>("/api/tasks"),
    refetchInterval: (q) => {
      if (paused) return false;
      const tasks = q.state.data ?? [];
      if (tasks.some((t) => t.status === "running")) return 10_000;
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
    mutationFn: (v: { title: string; repoUrl?: string }) =>
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
      model?: string;
      options?: PrOptionId[];
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

export function useModels(enabled: boolean) {
  return useQuery({
    queryKey: MODELS,
    queryFn: () => api<CursorModel[]>("/api/models"),
    enabled,
    // fixed list per key; only a key change invalidates it
    staleTime: Infinity,
    retry: false,
  });
}

export function useCursorKey(enabled = true) {
  return useQuery({
    queryKey: CURSOR_KEY,
    queryFn: () => api<{ hasKey: boolean }>("/api/settings/cursor-key"),
    enabled,
  });
}

export function useSaveCursorKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      api<{ hasKey: boolean }>("/api/settings/cursor-key", send("POST", { key })),
    onSuccess: (body) => {
      qc.setQueryData(CURSOR_KEY, body);
      // a new key changes which models — and which runs — the server can see
      qc.invalidateQueries({ queryKey: MODELS });
      qc.invalidateQueries({ queryKey: TASKS });
    },
  });
}

export function useClearCursorKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ hasKey: boolean }>("/api/settings/cursor-key", send("DELETE")),
    onSuccess: (body) => {
      qc.setQueryData(CURSOR_KEY, body);
      qc.invalidateQueries({ queryKey: MODELS });
      qc.invalidateQueries({ queryKey: TASKS });
    },
  });
}
