"use client";

import { useEffect, useState } from "react";
import type { Task, TaskStatus } from "@/app/lib/tasks";
import { repoLabel } from "@/app/lib/repos";

const STATUS_STYLE: Record<TaskStatus, string> = {
  inbox: "text-zinc-500",
  running: "text-blue-500",
  done: "text-green-600",
  failed: "text-red-500",
};

const REPO_STORAGE_KEY = "hitlist.repoUrl";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Task | null>(null);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/tasks");
    setTasks(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((data: Task[]) => {
        if (cancelled) return;
        setTasks(data);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REPO_STORAGE_KEY);
      if (stored) {
        // Defer so we don't sync-set during effect (react-hooks/set-state-in-effect).
        queueMicrotask(() => setRepoUrl(stored));
      }
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, []);

  function chooseRepo(url: string) {
    setRepoUrl(url);
    try {
      localStorage.setItem(REPO_STORAGE_KEY, url);
    } catch {
      // ignore storage errors
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t }),
    });
    load();
  }

  async function remove(id: string) {
    setTasks((prev) => prev.filter((task) => task.id !== id));
    setSelected(null);
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }

  async function toggleDone(task: Task) {
    const status: TaskStatus = task.status === "done" ? "inbox" : "done";
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status } : t)),
    );
    if (selected?.id === task.id) {
      setSelected({ ...task, status });
    }
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  function onDispatched(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelected(updated);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">HitList</h1>

      <RepoFold selected={repoUrl} onSelect={chooseRepo} />

      <form onSubmit={add} className="mb-6 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          enterKeyHint="done"
          autoFocus
          className="flex-1 rounded-xl border border-black/10 bg-transparent px-4 py-3 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
        />
        <button
          type="submit"
          className="rounded-xl bg-foreground px-5 py-3 text-base font-medium text-background active:opacity-70"
        >
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-zinc-500">Nothing here yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-xl border border-black/10 px-4 py-3 dark:border-white/15"
            >
              <input
                type="checkbox"
                checked={task.status === "done"}
                onChange={() => toggleDone(task)}
                aria-label={
                  task.status === "done"
                    ? `Mark ${task.title} as not done`
                    : `Mark ${task.title} as done`
                }
                className="size-5 shrink-0 accent-foreground"
              />
              <button
                onClick={() => setSelected(task)}
                className="flex flex-1 flex-col items-start gap-0.5 text-left"
              >
                <span
                  className={`break-words ${
                    task.status === "done"
                      ? "text-zinc-400 line-through"
                      : ""
                  }`}
                >
                  {task.title}
                </span>
                {task.status !== "inbox" && (
                  <span className={`text-xs ${STATUS_STYLE[task.status]}`}>
                    {task.status}
                  </span>
                )}
              </button>
              <button
                onClick={() => remove(task.id)}
                aria-label="Delete task"
                className="shrink-0 text-zinc-400 active:text-zinc-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <TaskSheet
          task={selected}
          repoUrl={repoUrl}
          onClose={() => setSelected(null)}
          onDispatched={onDispatched}
          onDelete={() => remove(selected.id)}
        />
      )}
    </main>
  );
}

function RepoFold({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<{ url: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || repos !== null) return;
    let cancelled = false;
    fetch("/api/repositories")
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        const items = (body.items ?? []) as { url: string }[];
        setRepos(items);
        if (!selected && items[0]) onSelect(items[0].url);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn’t load repositories");
          setRepos([]);
        }
      });
    return () => {
      cancelled = true;
    };
    // Fetch once when first expanded; selected/onSelect read from this open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, repos]);

  const loading = open && repos === null && !error;

  return (
    <div className="mb-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="repo-list"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-black/10 px-3 py-2.5 text-left text-sm dark:border-white/15"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/chevron.svg"
          alt=""
          aria-hidden="true"
          width={16}
          height={16}
          className={`shrink-0 opacity-60 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
        />
        <span className="font-medium">Repos</span>
        <span className="ml-auto truncate text-zinc-500">
          {selected ? repoLabel(selected) : "Choose…"}
        </span>
        <span className="sr-only">
          {open ? "Collapse repository list" : "Expand repository list"}
        </span>
      </button>

      {open && (
        <div id="repo-list" className="mt-2 px-1">
          {loading ? (
            <p className="py-2 text-sm text-zinc-500">Loading repos…</p>
          ) : error ? (
            <p className="py-2 text-sm text-red-500">{error}</p>
          ) : !repos || repos.length === 0 ? (
            <p className="py-2 text-sm text-zinc-500">No repositories found.</p>
          ) : (
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {repos.map((repo) => {
                const active = repo.url === selected;
                return (
                  <li key={repo.url}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(repo.url);
                        setOpen(false);
                      }}
                      className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm active:opacity-70 ${
                        active
                          ? "bg-foreground text-background"
                          : "text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      {repoLabel(repo.url)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TaskSheet({
  task,
  repoUrl,
  onClose,
  onDispatched,
  onDelete,
}: {
  task: Task;
  repoUrl: string | null;
  onClose: () => void;
  onDispatched: (t: Task) => void;
  onDelete: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    const res = await fetch(`/api/tasks/${task.id}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(repoUrl ? { repoUrl } : {}),
    });
    const body = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(body.error ?? "dispatch failed");
      return;
    }
    onDispatched(body);
  }

  return (
    <div
      className="fixed inset-0 z-10 flex flex-col justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 break-words text-lg font-medium">{task.title}</p>
        <p className={`text-sm ${STATUS_STYLE[task.status]}`}>{task.status}</p>
        {repoUrl ? (
          <p className="mb-5 mt-1 truncate text-xs text-zinc-500">
            {repoLabel(repoUrl)}
          </p>
        ) : (
          <div className="mb-5" />
        )}

        {task.status === "inbox" && (
          <button
            onClick={send}
            disabled={sending}
            className="mb-3 w-full rounded-xl bg-foreground py-3 text-base font-medium text-background active:opacity-70 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send to agent"}
          </button>
        )}

        {task.agentUrl && (
          <a
            href={task.agentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 block w-full rounded-xl border border-black/10 py-3 text-center text-base font-medium dark:border-white/15"
          >
            View agent ↗
          </a>
        )}

        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

        <button
          onClick={onDelete}
          className="w-full py-2 text-base text-red-500 active:opacity-70"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
