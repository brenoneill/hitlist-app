"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Task } from "@/app/lib/tasks";
import {
  useAddTask,
  useDeployDefaults,
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
  OFFERED_PROVIDER_IDS,
  pickDefaultProvider,
} from "@/app/lib/providerMeta";
import { optionsForMode } from "@/app/lib/prOptions";
import { type Repo } from "@/app/components/GithubRepos";
import { AppHeader } from "@/app/components/AppHeader";
import { Button } from "@/app/components/Button";
import {
  ProjectFilterSlideout,
  matchesProjectFilter,
  projectsWithHits,
} from "@/app/components/ProjectFilter";
import { GroupSheet, TaskSheet } from "@/app/components/Sheets";
import { inFlight, wasDeployed } from "@/app/components/TaskList";
import { ListTab } from "@/app/components/ListTab";
import { Chip } from "@/app/components/ui/Chip";
import { Menu } from "@/app/components/ui/Menu";
import { TextInput } from "@/app/components/ui/TextInput";
import { useToast } from "@/app/components/ui/Toast";

/** True once the user can tag repos and dispatch agents. */
function isSetupComplete(
  signedIn: boolean,
  connected: boolean,
  hasProviderKey: boolean,
) {
  return signedIn && connected && hasProviderKey;
}

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [title, setTitle] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    () => new Set(),
  );
  const [dragging, setDragging] = useState(false);
  const [undo, setUndo] = useState<Task[] | null>(null);
  // ponytail: localStorage, move to /api/settings if it needs to follow the user across devices
  const [blockedRepos, setBlockedRepos] = useState<number[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);
  const { showToast, clearToast, setTrayHidden } = useToast();

  // dragging pauses the poll so a refetch can't clobber the drag
  const { data, isLoading: loading } = useTasks(dragging);
  const tasks = useMemo(() => data ?? [], [data]);
  const { data: github, isFetched: reposFetched } = useRepos(signedIn);
  const { data: providerKeys, isFetched: keysFetched } =
    useProviderKeys(signedIn);
  const { data: deployDefaults } = useDeployDefaults(signedIn);
  const repos: Repo[] | null = github?.repos ?? null;
  const setupComplete = isSetupComplete(
    signedIn,
    github?.connected ?? false,
    Object.values(providerKeys ?? {}).some(Boolean),
  );
  // Offer the setup CTA only once the fetches settle — no flash for configured users.
  const showSetupCta =
    status !== "loading" &&
    (!signedIn || (reposFetched && keysFetched)) &&
    !setupComplete;
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

  // Focus after mount — autoFocus on the SSR'd input trips hydration on
  // Chrome iOS, which injects __gchrome_uniqueid before React attaches.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

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
          showToast(err.message || "failed to mark", { tone: "error" });
        },
      },
    );
  }

  function remove(id: string) {
    setSelectedId(null);
    removeTask.mutate(id);
  }

  // deployed work lives in the workspace; the sheet is only for configure & deploy
  function open(id: string) {
    const t = tasks.find((x) => x.id === id);
    if (t && wasDeployed(t)) router.push(`/app/task/${id}`);
    else setSelectedId(id);
  }

  function openGroup(groupId: string) {
    const lead = tasks.find((t) => t.groupId === groupId);
    if (lead && wasDeployed(lead)) router.push(`/app/task/${lead.id}`);
    else setSelectedGroup(groupId);
  }

  const projects = projectsWithHits(tasks);
  // Ignore selections for projects that no longer have hits (deleted/retagged).
  const liveProjectUrls = new Set(projects.map((p) => p.url));
  const activeProjectFilter = new Set(
    [...selectedProjects].filter((url) => liveProjectUrls.has(url)),
  );
  const visible = tasks.filter((t) =>
    matchesProjectFilter(t, activeProjectFilter, tasks),
  );

  /**
   * Applies a new order/grouping (optimistically, in the query cache).
   * Snapshots the previous order so the last change can be undone; pass null to
   * skip (that's the undo itself — no undoing the undo).
   */
  function persistOrder(next: Task[], snapshot: Task[] | null = tasks) {
    setUndo(snapshot);
    reorder.mutate(next);
    if (snapshot) {
      showToast("Undo move", {
        tone: "error",
        ms: 6000,
        action: {
          onClick: () => persistOrder(snapshot, null),
          hint: "⌘Z",
        },
      });
    } else {
      clearToast();
    }
  }

  /**
   * Persists a section reorder from the filtered list without dropping hits
   * that are hidden by the project filter (they keep their relative slots).
   */
  function persistVisibleOrder(
    nextFlying: Task[],
    nextPending: Task[],
    nextDone: Task[],
  ) {
    const nextVisible = [...nextFlying, ...nextPending, ...nextDone];
    if (activeProjectFilter.size === 0) {
      persistOrder(nextVisible);
      return;
    }
    const queue = [...nextVisible];
    persistOrder(
      tasks.map((t) =>
        matchesProjectFilter(t, activeProjectFilter, tasks)
          ? queue.shift()!
          : t,
      ),
    );
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
    // persistOrder closes over latest tasks; only rebind when undo snapshot changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [undo]);

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
    // Settings default provider if still configured; else last-used / first key
    const provider = pickDefaultProvider(
      OFFERED_PROVIDER_IDS.filter((p) => providerKeys?.[p]),
      deployDefaults?.provider ?? localStorage.getItem(LAST_PROVIDER_KEY),
    );
    dispatch.mutate(
      {
        id: task.id,
        ...(provider ? { provider } : {}),
        ...(deployDefaults?.model ? { model: deployDefaults.model } : {}),
        ...(deployDefaults?.visualConfirmation
          ? { options: optionsForMode(deployDefaults.visualConfirmation) }
          : {}),
        ...(wasDeployed(task) ? { redeploy: true } : {}),
      },
      {
        onError: (err) => {
          // the slimmed sheet can't redeploy, so failures there surface as a toast
          if (wasDeployed(task)) {
            showToast(err.message || "redeploy failed", { tone: "error" });
            return;
          }
          setSelectedGroup(null);
          setSelectedId(task.id);
        },
      },
    );
  }

  // done marks live at the bottom, newest kill first; the rest stay hand-sortable
  const active = visible.filter((t) => t.status !== "done");
  // deployed work rises to its own list above the untouched marks
  const flying = active.filter(inFlight);
  const pending = active.filter((t) => !inFlight(t));
  const done = visible
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
      <AppHeader />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top,0px)] bg-background"
      />
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-30 -mx-4 bg-background px-4 pb-4">
        <form onSubmit={add} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <TextInput
                ref={titleRef}
                tone="surface"
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
                  status === "unauthenticated" ? "mark-signin-hint" : undefined
                }
              />
              <Menu
                open={mentionOpen}
                onClose={() => setDismissed(true)}
                className="inset-x-0 top-full mt-1"
              >
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
              </Menu>
            </div>
            <Button
              type="submit"
              disabled={!signedIn || !title.trim()}
              className="px-5"
            >
              Mark
            </Button>
          </div>
          {(repo || projects.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {repo && (
                <Chip
                  variant="surface"
                  icon="crosshair"
                  onDismiss={() => setRepo(null)}
                  dismissLabel="Remove repo"
                >
                  {repo.name}
                </Chip>
              )}
              {projects.length > 0 && (
                <Chip
                  variant="surface"
                  icon="filter"
                  onClick={() => setProjectFilterOpen(true)}
                  className="ml-auto"
                  aria-label={
                    activeProjectFilter.size > 0
                      ? `Filter by project, ${activeProjectFilter.size} selected`
                      : "Filter by project"
                  }
                >
                  <span className="sr-only">
                    Filter
                    {activeProjectFilter.size > 0
                      ? ` · ${activeProjectFilter.size}`
                      : ""}
                  </span>
                </Chip>
              )}
            </div>
          )}
          {status === "unauthenticated" && (
            <p id="mark-signin-hint" className="font-mono text-xs text-muted">
              Sign in from Settings to mark hits
            </p>
          )}
        </form>
      </div>

      <ListTab
        onSelectProjectsChange={setSelectedProjects}
        onSelectId={open}
        onSelectGroup={openGroup}
        visible={visible}
        flying={flying}
        pending={pending}
        done={done}
        tasks={tasks}
        loading={loading}
        onReorderVisible={persistVisibleOrder}
        onToggleTask={toggle.mutate}
        onRemoveTask={remove}
        onDeployTask={deploy}
        onDraggingChange={(d) => {
          setDragging(d);
          setTrayHidden(d);
        }}
        showSetupCta={showSetupCta}
      />

      {selected && (
        <TaskSheet
          key={selected.id}
          task={selected}
          canDeploy={
            !!selected.repoUrl ||
            tasks.some(
              (t) => t.groupId && t.groupId === selected.groupId && !!t.repoUrl,
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

      {projectFilterOpen && (
        <ProjectFilterSlideout
          projects={projects}
          selected={activeProjectFilter}
          onChange={setSelectedProjects}
          onClose={() => setProjectFilterOpen(false)}
        />
      )}
    </main>
  );
}
