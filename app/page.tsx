"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { Task, TaskStatus } from "@/app/lib/tasks";
import { GithubRepos, type Repo } from "@/app/components/GithubRepos";
import { NoteIcon } from "@/app/icons/NoteIcon";

const STATUS_STYLE: Record<TaskStatus, string> = {
  inbox: "text-zinc-500",
  running: "text-blue-500",
  done: "text-green-600",
  failed: "text-red-500",
};

export default function Home() {
  const { status } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [connected, setConnected] = useState(false);
  const [reposError, setReposError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Task | null>(null);

  async function load() {
    const res = await fetch("/api/tasks");
    setTasks(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/github/repos")
      .then((res) => {
        setReposError(!res.ok);
        return res.ok ? res.json() : { connected: false, repos: [] };
      })
      .then((body) => {
        setConnected(body.connected);
        setRepos(body.repos);
      });
  }, [status]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || !repoUrl) return;
    setTitle("");
    setRepoUrl("");
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, repoUrl }),
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

      <GithubRepos repos={repos} connected={connected} />

      <form onSubmit={add} className="mb-6 flex flex-col gap-2">
        <div className="flex gap-2">
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
            disabled={!title.trim() || !repoUrl}
            className="rounded-xl bg-foreground px-5 py-3 text-base font-medium text-background active:opacity-70 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <select
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          disabled={!repos || repos.length === 0}
          className="w-full rounded-xl border border-black/10 bg-transparent px-4 py-3 text-base outline-none dark:border-white/15"
        >
          <option value="">
            {reposError
              ? "Couldn't load repos — try again"
              : !connected
                ? "Connect GitHub repos above to pick one"
                : !repos || repos.length === 0
                  ? "No repos shared yet"
                  : "Choose a repo…"}
          </option>
          {repos?.map((repo) => (
            <option key={repo.id} value={repo.url}>
              {repo.name}
            </option>
          ))}
        </select>
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
                type="button"
                onClick={() => setSelected(task)}
                aria-label={
                  task.note?.trim()
                    ? `Edit note for ${task.title}`
                    : `Add note for ${task.title}`
                }
                className={`shrink-0 active:opacity-70 ${
                  task.note?.trim() ? "text-foreground" : "text-zinc-400"
                }`}
              >
                <NoteIcon className="size-5" />
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
          key={selected.id}
          task={selected}
          onClose={() => setSelected(null)}
          onDispatched={onDispatched}
          onDelete={() => remove(selected.id)}
          onUpdated={(updated) => {
            setTasks((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t)),
            );
            setSelected(updated);
          }}
        />
      )}
    </main>
  );
}

function TaskSheet({
  task,
  onClose,
  onDispatched,
  onDelete,
  onUpdated,
}: {
  task: Task;
  onClose: () => void;
  onDispatched: (t: Task) => void;
  onDelete: () => void;
  onUpdated: (t: Task) => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(task.note ?? "");

  async function saveNote(next: string) {
    if (next === (task.note ?? "")) return;
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: next }),
    });
    if (!res.ok) return;
    onUpdated(await res.json());
  }

  async function send() {
    setSending(true);
    setError(null);
    await saveNote(note);
    const res = await fetch(`/api/tasks/${task.id}/dispatch`, {
      method: "POST",
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
        <p className={`mb-1 text-sm ${STATUS_STYLE[task.status]}`}>
          {task.status}
        </p>
        {task.repoUrl && (
          <p className="mb-4 truncate text-sm text-zinc-500">
            {task.repoUrl}
          </p>
        )}

        <label className="mb-5 block">
          <span className="mb-2 flex items-center gap-1.5 text-sm text-zinc-500">
            <NoteIcon className="size-4" />
            Note
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => saveNote(note)}
            placeholder="Extra context for the agent…"
            rows={3}
            className="w-full resize-none rounded-xl border border-black/10 bg-transparent px-4 py-3 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
          />
        </label>

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
