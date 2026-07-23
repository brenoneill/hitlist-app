"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { Task, TaskStatus } from "@/app/lib/tasks";
import { normalizeGroups } from "@/app/lib/groups";
import { GithubRepos, type Repo } from "@/app/components/GithubRepos";
import { Icon } from "@/app/components/Icons";
import { Tabs } from "@/app/components/Tabs";
import { DoneList, StatusBadge, TaskList } from "@/app/components/TaskList";

type Tab = "list" | "settings";

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
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [undo, setUndo] = useState<Task[] | null>(null);
  const [tab, setTab] = useState<Tab>("list");
  // ponytail: localStorage, move to /api/settings if it needs to follow the user across devices
  const [activeRepos, setActiveRepos] = useState<number[]>([]);

  useEffect(() => {
    setActiveRepos(JSON.parse(localStorage.getItem("activeRepos") ?? "[]"));
    setRepoUrl(localStorage.getItem("repoUrl") ?? "");
  }, []);

  function pickRepo(url: string) {
    setRepoUrl(url);
    localStorage.setItem("repoUrl", url);
  }

  function toggleActive(id: number) {
    setActiveRepos((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      localStorage.setItem("activeRepos", JSON.stringify(next));
      return next;
    });
  }

  const pickable = useMemo(
    () =>
      activeRepos.length
        ? repos?.filter((r) => activeRepos.includes(r.id))
        : repos,
    [repos, activeRepos],
  );

  // one repo to choose from → it's the target; otherwise the remembered pick, if it's still pickable
  const target =
    pickable?.length === 1
      ? pickable[0].url
      : pickable?.some((r) => r.url === repoUrl)
        ? repoUrl
        : "";

  async function load() {
    const res = await fetch("/api/tasks");
    setTasks(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // ponytail: poll only while an agent is out. setInterval over react-query —
  // one endpoint, no cache to share. Add the dep when a second view needs these tasks.
  // Paused while dragging so a refetch can't clobber mid-drag state.
  const anyRunning = tasks.some((t) => t.status === "running");
  useEffect(() => {
    if (!anyRunning || dragging) return;
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [anyRunning, dragging]);

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
    if (!t || !target) return;
    setTitle("");
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, repoUrl: target }),
    });
    load();
  }

  async function remove(id: string) {
    setTasks((prev) => normalizeGroups(prev.filter((task) => task.id !== id)));
    setSelected(null);
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }

  /**
   * Optimistically applies a new order/grouping, then persists and reconciles.
   * Snapshots the previous order so the last change can be undone; pass null to
   * skip (that's the undo itself — no undoing the undo).
   */
  async function persistOrder(next: Task[], snapshot: Task[] | null = tasks) {
    setUndo(snapshot);
    setTasks(next);
    const res = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: next.map((t) => ({ id: t.id, groupId: t.groupId ?? null })),
      }),
    });
    if (res.ok) setTasks(await res.json());
  }

  // the undo offer expires; ⌘Z / ctrl+Z takes it too, unless you're typing
  useEffect(() => {
    const prev = undo;
    if (!prev) return;
    const timer = setTimeout(() => setUndo(null), 6000);
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
      if (e.key !== "z" || !(e.metaKey || e.ctrlKey) || e.shiftKey) return;
      e.preventDefault();
      persistOrder(prev, null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [undo]);

  function disband(groupId: string) {
    setSelectedGroup(null);
    persistOrder(
      tasks.map((t) =>
        t.groupId === groupId ? { ...t, groupId: undefined } : t,
      ),
    );
  }

  async function toggleDone(task: Task) {
    const status: TaskStatus = task.status === "done" ? "inbox" : "done";
    // mirrors the server's stamp so the done list sorts right before the next load
    const doneAt = status === "done" ? new Date().toISOString() : task.doneAt;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status, doneAt } : t)),
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

  // done marks live at the bottom, newest kill first; the rest stay hand-sortable
  const active = tasks.filter((t) => t.status !== "done");
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt));

  // derived so the open sheet tracks poll updates; empty (sheet closed) once disbanded
  const groupMembers = selectedGroup
    ? tasks.filter((t) => t.groupId === selectedGroup)
    : [];

  function onDispatched(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelected(updated);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Icon name="crosshair" className="size-6 text-blood" />
        HITLIST
      </h1>

      <Tabs
        tabs={[
          { id: "list", label: "List", icon: "list" },
          { id: "settings", label: "Settings", icon: "settings" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "settings" && (
        <GithubRepos
          repos={repos}
          connected={connected}
          activeRepos={activeRepos}
          onToggleActive={toggleActive}
        />
      )}

      {tab === "list" && (
        <>
      <form onSubmit={add} className="mb-6 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name your next hit…"
            enterKeyHint="done"
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-edge bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-blood"
          />
          <button
            type="submit"
            disabled={!title.trim() || !target}
            className="rounded-xl bg-blood px-5 py-3 font-mono text-sm font-bold uppercase tracking-widest text-white shadow-[0_0_16px_rgba(220,38,38,0.4)] active:opacity-80 disabled:opacity-40 disabled:shadow-none"
          >
            Mark
          </button>
        </div>
        <div className="relative">
          <select
            value={target}
            onChange={(e) => pickRepo(e.target.value)}
            disabled={!pickable || pickable.length === 0}
            className="w-full appearance-none rounded-xl border border-edge bg-surface px-4 py-3 pr-10 text-base outline-none focus:border-blood"
          >
            <option value="">
              {reposError
                ? "Couldn't load repos — try again"
                : !connected
                  ? "Connect GitHub repos above to pick one"
                  : !pickable || pickable.length === 0
                    ? "No repos shared yet"
                    : "Choose a target repo…"}
            </option>
            {pickable?.map((repo) => (
              <option key={repo.id} value={repo.url}>
                {repo.name}
              </option>
            ))}
          </select>
          <Icon
            name="chevron"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
        </div>
      </form>

      {loading ? (
        <p className="font-mono text-sm uppercase tracking-widest text-muted">
          Scanning…
        </p>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center pt-12">
          <Icon name="crosshair" className="mb-3 size-10 text-edge" />
          <p className="font-mono text-sm uppercase tracking-widest text-muted">
            No active marks
          </p>
        </div>
      ) : (
        <>
          <TaskList
            tasks={active}
            onReorder={(next) => persistOrder([...next, ...done])}
            onSelect={setSelected}
            onSelectGroup={setSelectedGroup}
            onToggle={toggleDone}
            onDelete={remove}
            onDraggingChange={setDragging}
          />
          {done.length > 0 && (
            <DoneList
              tasks={done}
              onSelect={setSelected}
              onToggle={toggleDone}
              onDelete={remove}
            />
          )}
        </>
      )}
        </>
      )}

      {undo && !dragging && (
        <div className="fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-4">
          <button
            onClick={() => persistOrder(undo, null)}
            className="flex items-center gap-2 rounded-xl border border-edge bg-surface px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest shadow-lg shadow-black/50 active:opacity-80"
          >
            <Icon name="x" className="size-3.5 text-blood" />
            Undo move
            <span className="text-muted">⌘Z</span>
          </button>
        </div>
      )}

      {selected && (
        <TaskSheet
          task={selected}
          onClose={() => setSelected(null)}
          onDispatched={onDispatched}
          onDelete={() => remove(selected.id)}
        />
      )}

      {groupMembers.length > 0 && (
        <GroupSheet
          members={groupMembers}
          onClose={() => setSelectedGroup(null)}
          onDeployed={load}
          onDisband={() => disband(selectedGroup!)}
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
      className="fixed inset-0 z-10 flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl border-t border-edge bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 break-words text-lg font-medium">{task.title}</p>
        <div className="mb-1">
          <StatusBadge status={task.status} />
        </div>
        {task.repoUrl && (
          <p className="mb-5 truncate font-mono text-xs text-muted">
            {task.repoUrl}
          </p>
        )}

        {task.status === "inbox" && (
          <button
            onClick={send}
            disabled={sending}
            className="mb-3 w-full rounded-xl bg-blood py-3 font-mono text-sm font-bold uppercase tracking-widest text-white shadow-[0_0_16px_rgba(220,38,38,0.4)] active:opacity-80 disabled:opacity-40 disabled:shadow-none"
          >
            {sending ? "Deploying…" : "Deploy agent"}
          </button>
        )}

        {task.agentUrl && (
          <a
            href={task.agentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 font-mono text-sm font-bold uppercase tracking-widest active:bg-background"
          >
            View agent
            <Icon name="external" className="size-4" />
          </a>
        )}

        {error && <p className="mb-3 font-mono text-xs text-blood">{error}</p>}

        <button
          onClick={onDelete}
          className="flex w-full items-center justify-center gap-2 py-2 text-base text-blood active:opacity-70"
        >
          <Icon name="trash" className="size-4" />
          Delete
        </button>
      </div>
    </div>
  );
}

function GroupSheet({
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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lead = members[0];

  async function send() {
    setSending(true);
    setError(null);
    // dispatching any member dispatches the whole group as one agent
    const res = await fetch(`/api/tasks/${lead.id}/dispatch`, {
      method: "POST",
    });
    const body = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(body.error ?? "dispatch failed");
      return;
    }
    onDeployed();
  }

  return (
    <div
      className="fixed inset-0 z-10 flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl border-t border-edge bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="mb-1">
          <StatusBadge status={lead.status} />
        </div>
        {lead.repoUrl && (
          <p className="mb-5 truncate font-mono text-xs text-muted">
            {lead.repoUrl}
          </p>
        )}

        {lead.status === "inbox" && (
          <button
            onClick={send}
            disabled={sending}
            className="mb-3 w-full rounded-xl bg-blood py-3 font-mono text-sm font-bold uppercase tracking-widest text-white shadow-[0_0_16px_rgba(220,38,38,0.4)] active:opacity-80 disabled:opacity-40 disabled:shadow-none"
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

        <button
          onClick={onDisband}
          className="flex w-full items-center justify-center gap-2 py-2 text-base text-muted active:opacity-70"
        >
          <Icon name="x" className="size-4" />
          Disband group
        </button>
      </div>
    </div>
  );
}
