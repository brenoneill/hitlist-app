"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { Task } from "@/app/lib/tasks";
import {
  useAddTask,
  useDispatchTask,
  useProviderKeys,
  useRemoveTask,
  useReorderTasks,
  useRepos,
  useTasks,
  useToggleDone,
} from "@/app/lib/queries";
import {
  LAST_PROVIDER_KEY,
  PROVIDER_IDS,
  pickDefaultProvider,
} from "@/app/lib/providerMeta";
import { GithubRepos, type Repo } from "@/app/components/GithubRepos";
import { BLOOD_BUTTON, Icon } from "@/app/components/Icons";
import { GroupSheet, TaskSheet } from "@/app/components/Sheets";
import { TabPanel, Tabs } from "@/app/components/Tabs";
import {
  DoneList,
  TaskList,
  inFlight,
  wasDeployed,
} from "@/app/components/TaskList";

type Tab = "list" | "settings";

const SECTION_LABEL =
  "mb-2 mt-6 font-mono text-[11px] uppercase tracking-widest text-muted first:mt-0";

const TOAST_SHELL =
  "fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-4";
const TOAST_PILL =
  "flex items-center gap-2 rounded-xl border border-edge bg-surface px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest shadow-lg shadow-black/50";

const LIST_FIRST: { id: Tab; label: string; icon: "list" | "settings" }[] = [
  { id: "list", label: "List", icon: "list" },
  { id: "settings", label: "Settings", icon: "settings" },
];
const SETTINGS_FIRST: { id: Tab; label: string; icon: "list" | "settings" }[] =
  [
    { id: "settings", label: "Settings", icon: "settings" },
    { id: "list", label: "List", icon: "list" },
  ];

/** True once the user can tag repos and dispatch agents. */
function isSetupComplete(
  signedIn: boolean,
  connected: boolean,
  hasProviderKey: boolean,
) {
  return signedIn && connected && hasProviderKey;
}

export default function Home() {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [title, setTitle] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [undo, setUndo] = useState<Task[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // null until session + (when signed in) key/GitHub fetches settle — avoids a Settings→List jump
  const [tab, setTab] = useState<Tab | null>(null);
  // ponytail: localStorage, move to /api/settings if it needs to follow the user across devices
  const [blockedRepos, setBlockedRepos] = useState<number[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);
  const wasSetupComplete = useRef(false);

  // dragging pauses the poll so a refetch can't clobber the drag
  const { data, isLoading: loading } = useTasks(dragging);
  const tasks = useMemo(() => data ?? [], [data]);
  const { data: github, isFetched: reposFetched } = useRepos(signedIn);
  const { data: providerKeys, isFetched: keysFetched } =
    useProviderKeys(signedIn);
  const repos: Repo[] | null = github?.repos ?? null;
  const setupComplete = isSetupComplete(
    signedIn,
    github?.connected ?? false,
    Object.values(providerKeys ?? {}).some(Boolean),
  );
  const addTask = useAddTask();
  const removeTask = useRemoveTask();
  const reorder = useReorderTasks();
  const toggle = useToggleDone();
  const dispatch = useDispatchTask();

  // every sheet reads through the cache, so a poll or a mutation keeps it live
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    setBlockedRepos(JSON.parse(localStorage.getItem("blockedRepos") ?? "[]"));
  }, []);

  // Hold the tab decision until keys + GitHub connection are known; then land once.
  useEffect(() => {
    if (status === "loading") return;
    if (signedIn && (!reposFetched || !keysFetched)) return;
    if (setupComplete) {
      if (!wasSetupComplete.current) {
        wasSetupComplete.current = true;
        setTab("list");
      }
      return;
    }
    wasSetupComplete.current = false;
    setTab("settings");
  }, [status, signedIn, reposFetched, keysFetched, setupComplete]);

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

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    addTask.mutate(
      { title: t, repoUrl: repo?.url },
      {
        onError: (err) => {
          setTitle(t);
          setToast(err.message || "failed to mark");
        },
      },
    );
  }

  function remove(id: string) {
    setSelectedId(null);
    removeTask.mutate(id);
  }

  /**
   * Applies a new order/grouping (optimistically, in the query cache).
   * Snapshots the previous order so the last change can be undone; pass null to
   * skip (that's the undo itself — no undoing the undo).
   */
  function persistOrder(next: Task[], snapshot: Task[] | null = tasks) {
    setUndo(snapshot);
    reorder.mutate(next);
  }

  // the undo offer expires; ⌘Z / ctrl+Z takes it too, unless you're typing
  useEffect(() => {
    const prev = undo;
    if (!prev) return;
    setToast(null);
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

  // error toasts share the undo tray; they expire the same way
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  function disband(groupId: string) {
    setSelectedGroup(null);
    persistOrder(
      tasks.map((t) =>
        t.groupId === groupId ? { ...t, groupId: undefined } : t,
      ),
    );
  }

  /** Dispatches from the row menu; on failure opens the sheet so the user can retry. */
  function deploy(task: Task) {
    // last-used provider if still configured; undefined lets the server default
    const provider = pickDefaultProvider(
      PROVIDER_IDS.filter((p) => providerKeys?.[p]),
      localStorage.getItem(LAST_PROVIDER_KEY),
    );
    dispatch.mutate(
      {
        id: task.id,
        ...(provider ? { provider } : {}),
        ...(wasDeployed(task) ? { redeploy: true } : {}),
      },
      {
        onError: () => {
          setSelectedGroup(null);
          setSelectedId(task.id);
        },
      },
    );
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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Icon name="crosshair" className="size-6 text-blood" />
        HITLIST
      </h1>

      {tab === null ? (
        <div aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading settings</span>
          <div className="mb-6 flex gap-1 rounded-xl border border-edge bg-surface p-1">
            <div className="h-10 flex-1 animate-pulse rounded-lg bg-edge/80 motion-reduce:animate-none" />
            <div className="h-10 flex-1 animate-pulse rounded-lg bg-edge/50 motion-reduce:animate-none" />
          </div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="h-4 w-28 animate-pulse rounded bg-edge motion-reduce:animate-none" />
            <div className="h-4 w-16 animate-pulse rounded bg-edge/60 motion-reduce:animate-none" />
          </div>
          <div className="mb-6 flex gap-2">
            <div className="h-12 min-w-0 flex-1 animate-pulse rounded-xl border border-edge bg-surface motion-reduce:animate-none" />
            <div className="h-12 w-[4.5rem] animate-pulse rounded-xl border border-edge bg-surface motion-reduce:animate-none" />
          </div>
          <div className="h-28 animate-pulse rounded-xl border border-edge bg-surface motion-reduce:animate-none" />
        </div>
      ) : (
        <Tabs
          tabs={setupComplete ? LIST_FIRST : SETTINGS_FIRST}
          active={tab}
          onChange={setTab}
        >
          <TabPanel id="settings">
            <GithubRepos
              repos={repos}
              connected={github?.connected ?? false}
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
                    placeholder={
                      signedIn
                        ? "Name your next hit… (-- tags a repo)"
                        : "Sign in to mark hits…"
                    }
                    enterKeyHint="done"
                    autoCorrect="off"
                    disabled={!signedIn}
                    // Chrome iOS / autofill may inject attrs (e.g. __gchrome_uniqueid)
                    // onto inputs before hydration; those are harmless and unavoidable.
                    suppressHydrationWarning
                    aria-describedby={
                      status === "unauthenticated"
                        ? "mark-signin-hint"
                        : undefined
                    }
                    className="w-full rounded-xl border border-edge bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-blood disabled:opacity-50"
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
                  disabled={!signedIn || !title.trim()}
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
              {status === "unauthenticated" && (
                <p
                  id="mark-signin-hint"
                  className="font-mono text-xs text-muted"
                >
                  Sign in from Settings to mark hits
                </p>
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
                {!setupComplete && (
                  <button
                    onClick={() => setTab("settings")}
                    className="mt-4 font-mono text-xs text-muted underline underline-offset-4"
                  >
                    Finish setup in Settings →
                  </button>
                )}
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
                      onSelect={(t) => setSelectedId(t.id)}
                      onSelectGroup={setSelectedGroup}
                      onToggle={toggle.mutate}
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
                      onSelect={(t) => setSelectedId(t.id)}
                      onSelectGroup={setSelectedGroup}
                      onToggle={toggle.mutate}
                      onDelete={remove}
                      onDeploy={deploy}
                      onDraggingChange={setDragging}
                    />
                  </>
                )}
                {done.length > 0 && (
                  <DoneList
                    tasks={done}
                    onSelect={(t) => setSelectedId(t.id)}
                    onToggle={toggle.mutate}
                    onDelete={remove}
                  />
                )}
              </>
            )}
          </TabPanel>
        </Tabs>
      )}

      {undo && !dragging ? (
        <div className={TOAST_SHELL}>
          <button
            onClick={() => persistOrder(undo, null)}
            className={`${TOAST_PILL} active:opacity-80`}
          >
            <Icon name="x" className="size-3.5 text-blood" />
            Undo move
            <span className="text-muted">⌘Z</span>
          </button>
        </div>
      ) : (
        toast && (
          <div className={TOAST_SHELL}>
            <div role="alert" className={TOAST_PILL}>
              <Icon name="x" className="size-3.5 text-blood" />
              {toast}
            </div>
          </div>
        )
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
          onClose={() => setSelectedId(null)}
          onDelete={() => remove(selected.id)}
        />
      )}

      {groupMembers.length > 0 && (
        <GroupSheet
          members={groupMembers}
          onClose={() => setSelectedGroup(null)}
          onEditMember={(t) => {
            setSelectedGroup(null);
            setSelectedId(t.id);
          }}
          onDisband={() => disband(selectedGroup!)}
        />
      )}
    </main>
  );
}
