"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { Task, TaskStatus } from "@/app/lib/tasks";
import { normalizeGroups } from "@/app/lib/groups";
import { GithubRepos, type Repo } from "@/app/components/GithubRepos";
import { BLOOD_BUTTON, Icon } from "@/app/components/Icons";
import { GroupSheet, TaskSheet } from "@/app/components/Sheets";
import { TabPanel, Tabs } from "@/app/components/Tabs";
import { DoneList, TaskList, inFlight } from "@/app/components/TaskList";

type Tab = "list" | "settings";

const SECTION_LABEL =
  "mb-2 mt-6 font-mono text-[11px] uppercase tracking-widest text-muted first:mt-0";

export default function Home() {
  const { status } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Task | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [undo, setUndo] = useState<Task[] | null>(null);
  const [tab, setTab] = useState<Tab>("list");
  // ponytail: localStorage, move to /api/settings if it needs to follow the user across devices
  const [blockedRepos, setBlockedRepos] = useState<number[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBlockedRepos(JSON.parse(localStorage.getItem("blockedRepos") ?? "[]"));
  }, []);

  // Focus after mount — autoFocus on the SSR'd input trips hydration on
  // Chrome iOS, which injects __gchrome_uniqueid before React attaches.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function toggleBlocked(id: number) {
    setBlockedRepos((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      localStorage.setItem("blockedRepos", JSON.stringify(next));
      return next;
    });
  }

  const pickable = useMemo(
    () => repos?.filter((r) => !blockedRepos.includes(r.id)) ?? [],
    [repos, blockedRepos],
  );

  // -- mention picker: chip is the chosen repo, dropdown filters as you type
  const [repo, setRepo] = useState<Repo | null>(null);
  const [mIdx, setMIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  // ponytail: trigger only matches at the end of the input; mid-string caret editing won't open it
  // iOS smart punctuation turns "--" into an em/en dash, so accept those too
  const mention = title.match(/(?:--|[—–])(\S*)$/);
  const matches =
    mention && !dismissed
      ? pickable
          .filter((r) =>
            r.name.toLowerCase().includes(mention[1].toLowerCase()),
          )
          .slice(0, 6)
      : [];
  const mentionOpen = matches.length > 0;

  function pickMention(r: Repo) {
    setRepo(r);
    setTitle((t) => t.replace(/(?:--|[—–])\S*$/, "").trimEnd());
  }

  function onTitleKeyDown(e: React.KeyboardEvent) {
    if (!mentionOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMIdx((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMIdx((i) => (i + matches.length - 1) % matches.length);
    } else if (e.key === "Enter") {
      // picks instead of submitting the form
      e.preventDefault();
      pickMention(matches[Math.min(mIdx, matches.length - 1)]);
    } else if (e.key === "Escape") {
      setDismissed(true);
    }
  }

  async function load() {
    const res = await fetch("/api/tasks");
    setTasks(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // ponytail: poll only while an agent is out (10s) or a PR is still open (60s —
  // merges aren't urgent and every check costs a GitHub call). Stops dead once
  // every PR is merged/closed. setInterval over react-query — one endpoint, no
  // cache to share. Paused while dragging so a refetch can't clobber the drag.
  const anyRunning = tasks.some((t) => t.status === "running");
  const anyOpenPr = tasks.some(
    (t) => t.prUrl && (t.prState ?? "open") === "open",
  );
  const pollMs = anyRunning ? 10_000 : anyOpenPr ? 60_000 : 0;
  useEffect(() => {
    if (!pollMs || dragging) return;
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [pollMs, dragging]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/github/repos")
      .then((res) => (res.ok ? res.json() : { connected: false, repos: [] }))
      .then((body) => {
        setConnected(body.connected);
        setRepos(body.repos);
      });
  }, [status]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, repoUrl: repo?.url }),
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

  /** Dispatches from the row menu; on failure opens the sheet so the user can retry. */
  async function deploy(task: Task) {
    const res = await fetch(`/api/tasks/${task.id}/dispatch`, {
      method: "POST",
    });
    if (!res.ok) {
      setSelectedGroup(null);
      setSelected(task);
      return;
    }
    onDispatched(await res.json());
  }

  // done marks live at the bottom, newest kill first; the rest stay hand-sortable
  const active = tasks.filter((t) => t.status !== "done");
  // deployed work rises to its own list above the untouched marks
  const flying = active.filter(inFlight);
  const pending = active.filter((t) => !inFlight(t));
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) =>
      (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt),
    );

  // derived so the open sheet tracks poll updates; empty (sheet closed) once disbanded
  const groupMembers = selectedGroup
    ? tasks.filter((t) => t.groupId === selectedGroup)
    : [];

  // a grouped task dispatches its whole group, so this can come back as a list
  function onDispatched(updated: Task | Task[]) {
    const next = [updated].flat();
    setTasks((prev) => prev.map((t) => next.find((u) => u.id === t.id) ?? t));
    setSelected((s) => next.find((u) => u.id === s?.id) ?? s);
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
      >
        <TabPanel id="settings">
          <GithubRepos
            repos={repos}
            connected={connected}
            blockedRepos={blockedRepos}
            onToggleBlocked={toggleBlocked}
          />
        </TabPanel>

        <TabPanel id="list">
          <form onSubmit={add} className="mb-6 flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDismissed(false);
                    setMIdx(0);
                  }}
                  onKeyDown={onTitleKeyDown}
                  placeholder="Name your next hit… (-- tags a repo)"
                  enterKeyHint="done"
                  autoCorrect="off"
                  // Chrome iOS / autofill may inject attrs (e.g. __gchrome_uniqueid)
                  // onto inputs before hydration; those are harmless and unavoidable.
                  suppressHydrationWarning
                  className="w-full rounded-xl border border-edge bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-blood"
                />
                {mentionOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDismissed(true)}
                    />
                    <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-edge bg-surface shadow-lg shadow-black/50">
                      {matches.map((r, i) => (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => pickMention(r)}
                          className={`block w-full truncate px-4 py-2.5 text-left font-mono text-sm ${
                            i === mIdx ? "bg-background" : ""
                          }`}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                type="submit"
                disabled={!title.trim()}
                className={`${BLOOD_BUTTON} px-5`}
              >
                Mark
              </button>
            </div>
            {repo && (
              <span className="flex items-center gap-1.5 self-start rounded-full border border-edge bg-surface px-3 py-1 font-mono text-xs">
                <Icon name="crosshair" className="size-3 text-blood" />
                {repo.name}
                <button
                  type="button"
                  onClick={() => setRepo(null)}
                  aria-label="Remove repo"
                >
                  <Icon name="x" className="size-3 text-muted" />
                </button>
              </span>
            )}
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
              {flying.length > 0 && (
                <>
                  <h2 className={SECTION_LABEL}>{flying.length} deployed</h2>
                  <TaskList
                    tasks={flying}
                    onReorder={(next) =>
                      persistOrder([...next, ...pending, ...done])
                    }
                    onSelect={setSelected}
                    onSelectGroup={setSelectedGroup}
                    onToggle={toggleDone}
                    onDelete={remove}
                    onDeploy={deploy}
                    onDraggingChange={setDragging}
                  />
                </>
              )}
              {pending.length > 0 && (
                <>
                  {flying.length > 0 && (
                    <h2 className={SECTION_LABEL}>{pending.length} marked</h2>
                  )}
                  <TaskList
                    tasks={pending}
                    onReorder={(next) =>
                      persistOrder([...flying, ...next, ...done])
                    }
                    onSelect={setSelected}
                    onSelectGroup={setSelectedGroup}
                    onToggle={toggleDone}
                    onDelete={remove}
                    onDeploy={deploy}
                    onDraggingChange={setDragging}
                  />
                </>
              )}
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
        </TabPanel>
      </Tabs>

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
          key={selected.id}
          task={selected}
          canDeploy={
            !!selected.repoUrl ||
            tasks.some(
              (t) =>
                t.groupId && t.groupId === selected.groupId && !!t.repoUrl,
            )
          }
          repos={pickable}
          onClose={() => setSelected(null)}
          onDispatched={onDispatched}
          onDelete={() => remove(selected.id)}
        />
      )}

      {groupMembers.length > 0 && (
        <GroupSheet
          members={groupMembers}
          onClose={() => setSelectedGroup(null)}
          onEditMember={(t) => {
            setSelectedGroup(null);
            setSelected(t);
          }}
          onDeployed={load}
          onDisband={() => disband(selectedGroup!)}
        />
      )}
    </main>
  );
}
