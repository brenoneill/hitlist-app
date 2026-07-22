"use client";

import { useEffect, useState } from "react";
import type { Task, TaskStatus } from "@/app/lib/tasks";

const STATUS_STYLE: Record<TaskStatus, string> = {
  inbox: "text-zinc-500",
  running: "text-blue-500",
  done: "text-green-600",
  failed: "text-red-500",
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
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

  function onDispatched(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelected(updated);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">HitList</h1>

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
          onClose={() => setSelected(null)}
          onDispatched={onDispatched}
          onDelete={() => remove(selected.id)}
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
}: {
  task: Task;
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
        <p className={`mb-5 text-sm ${STATUS_STYLE[task.status]}`}>
          {task.status}
        </p>

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
