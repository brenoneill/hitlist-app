"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import type { Task } from "@/app/lib/tasks";
import { newId } from "@/app/lib/id";
import { BLOOD_BUTTON, Icon, type IconName } from "@/app/components/Icons";
import {
  DoneList,
  TaskList,
  inFlight,
  wasDeployed,
} from "@/app/components/TaskList";

const SECTION_LABEL =
  "mb-2 mt-6 font-mono text-[11px] uppercase tracking-widest text-muted first:mt-0";

const DEMO_SEED: Task[] = [
  {
    id: "demo-1",
    title: "Rename the empty state copy",
    status: "inbox",
    createdAt: "2026-07-31T10:00:00.000Z",
    repoUrl: "https://github.com/demo/hitlist-app",
  },
  {
    id: "demo-2",
    title: "Tighten the mark input hint",
    status: "running",
    createdAt: "2026-07-31T10:05:00.000Z",
    repoUrl: "https://github.com/demo/hitlist-app",
    agentUrl: "https://example.com/agent/demo-2",
    runStatus: "RUNNING",
    dispatchedAt: "2026-07-31T10:06:00.000Z",
  },
  {
    id: "demo-3",
    title: "Fix favicon flash on cold start",
    status: "inbox",
    createdAt: "2026-07-31T09:30:00.000Z",
    repoUrl: "https://github.com/demo/docs",
    agentUrl: "https://example.com/agent/demo-3",
    prUrl: "https://github.com/demo/docs/pull/12",
    prState: "open",
  },
  {
    id: "demo-4",
    title: "Strip unused toast styles",
    status: "done",
    createdAt: "2026-07-30T18:00:00.000Z",
    doneAt: "2026-07-30T19:00:00.000Z",
    mergedAt: "2026-07-30T19:00:00.000Z",
    prUrl: "https://github.com/demo/hitlist-app/pull/8",
    prState: "merged",
    agentUrl: "https://example.com/agent/demo-4",
    repoUrl: "https://github.com/demo/hitlist-app",
  },
];

const FEATURES: {
  icon: IconName;
  title: string;
  body: string;
}[] = [
  {
    icon: "crosshair",
    title: "Mark small hits",
    body: "Capture tiny tasks the moment they show up — before they evaporate between meetings.",
  },
  {
    icon: "github",
    title: "Tag a repo",
    body: "Type -- in the mark field to pin a GitHub repo. The agent already knows where to work.",
  },
  {
    icon: "cursor",
    title: "Deploy a cloud agent",
    body: "Hand the hit to Cursor or Copilot from your phone. Come back when the PR is ready.",
  },
  {
    icon: "pr",
    title: "Track the run",
    body: "See agent status, PR links, and merges without opening a desktop dashboard.",
  },
  {
    icon: "list",
    title: "Group & reorder",
    body: "Stack related hits, drag to prioritize, and keep the pocket list under control.",
  },
  {
    icon: "filter",
    title: "Filter by project",
    body: "Narrow the list to one repo when you’re mid-context and don’t want noise.",
  },
];

const BENEFITS = [
  {
    title: "Built for pocket work",
    body: "Running a major agent session from mobile is rough. Marking a small hit and dispatching it isn’t.",
  },
  {
    title: "Thought → agent → PR",
    body: "Capture the task, tag the repo, fire an agent provider, and follow the pull request from the same list.",
  },
  {
    title: "Keep the big work elsewhere",
    body: "Save deep refactors for a real machine. Use HitList for the cuts, copy tweaks, and one-file fixes.",
  },
];

/**
 * Marketing landing for signed-out visitors. Includes a local interactive hit
 * list demo that reuses the app TaskList / DoneList components.
 */
export function Landing() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(220,38,38,0.22),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.08),transparent_35%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(237,237,237,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(237,237,237,0.8)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Icon name="crosshair" className="size-5 text-blood" />
          HITLIST
        </span>
        <button
          type="button"
          onClick={() => signIn("github")}
          className="font-mono text-[11px] uppercase tracking-widest text-muted transition-colors hover:text-foreground"
        >
          Sign in
        </button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-16">
        <section className="flex min-h-[min(88vh,52rem)] flex-col justify-center py-10">
          <div className="animate-rise">
            <h1 className="flex items-center gap-3 text-5xl font-bold tracking-tight sm:text-6xl">
              <Icon
                name="crosshair"
                className="size-12 animate-crosshair text-blood sm:size-14"
              />
              HITLIST
            </h1>
            <p className="mt-5 max-w-xl text-xl leading-snug text-foreground/90 sm:text-2xl">
              Small hits. Cloud agents. From your phone.
            </p>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">
              Major agent work belongs on a real machine. HitList is for the
              tiny tasks — mark them, tag a repo, and fire a web agent while
              you’re on the go.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => signIn("github")}
                className={`${BLOOD_BUTTON} inline-flex items-center gap-2 px-6`}
              >
                <Icon name="github" className="size-4" />
                Sign in with GitHub
              </button>
              <a
                href="#demo"
                className="rounded-xl border border-edge px-5 py-3 font-mono text-sm font-bold uppercase tracking-widest text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                Try the demo
              </a>
            </div>
          </div>
        </section>

        <section
          id="demo"
          className="scroll-mt-8 animate-rise-delay-1 border-t border-edge/80 pt-12"
        >
          <p className={SECTION_LABEL}>Interactive</p>
          <h2 className="text-2xl font-bold tracking-tight">
            Same list you’ll use in the app
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Drag to reorder, swipe or open the menu to mark executed, delete, or
            simulate a deploy. Nothing here is saved — it’s a sandbox of the
            real components.
          </p>
          <div className="relative mx-auto mt-8 max-w-md">
            <div
              aria-hidden
              className="absolute -inset-3 rounded-[1.75rem] bg-blood/10 blur-2xl animate-glow"
            />
            <DemoHitList />
          </div>
        </section>

        <section className="animate-rise-delay-2 border-t border-edge/80 pt-12 mt-16">
          <p className={SECTION_LABEL}>Why HitList</p>
          <h2 className="text-2xl font-bold tracking-tight">
            Built for the cuts, not the campaigns
          </h2>
          <ul className="mt-8 space-y-8">
            {BENEFITS.map((b) => (
              <li key={b.title}>
                <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <Icon name="check" className="size-4 text-blood" />
                  {b.title}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                  {b.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-edge/80 pt-12 mt-16">
          <p className={SECTION_LABEL}>Features</p>
          <h2 className="text-2xl font-bold tracking-tight">
            Everything you need on one screen
          </h2>
          <ul className="mt-8 grid gap-8 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <h3 className="flex items-center gap-2 font-semibold tracking-tight">
                  <Icon name={f.icon} className="size-4 text-blood" />
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {f.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 rounded-2xl border border-edge bg-surface/60 px-5 py-10 text-center sm:px-10">
          <Icon name="crosshair" className="mx-auto size-8 text-blood" />
          <h2 className="mt-4 text-2xl font-bold tracking-tight">
            Put a hit list in your pocket
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Sign in, connect an agent provider, and start marking the small work
            that shouldn’t wait until you’re back at a desk.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => signIn("github")}
              className={`${BLOOD_BUTTON} inline-flex items-center gap-2 px-6`}
            >
              <Icon name="github" className="size-4" />
              Get started
            </button>
            <Link
              href="/app"
              className="rounded-xl border border-edge px-5 py-3 font-mono text-sm font-bold uppercase tracking-widest text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              Open app
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-edge/60 py-6 text-center font-mono text-[11px] uppercase tracking-widest text-muted">
        HitList — small tasks, cloud agents
      </footer>
    </div>
  );
}

/**
 * Local-only hit list sandbox that reuses TaskList / DoneList from the app.
 * Mutations stay in component state and never hit the API.
 */
function DemoHitList() {
  const [tasks, setTasks] = useState<Task[]>(DEMO_SEED);
  const [title, setTitle] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const flying = useMemo(() => tasks.filter(inFlight), [tasks]);
  const pending = useMemo(
    () => tasks.filter((t) => t.status !== "done" && !inFlight(t)),
    [tasks],
  );
  const done = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "done")
        .sort((a, b) =>
          (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt),
        ),
    [tasks],
  );

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    setTasks((prev) => [
      {
        id: newId(),
        title: t,
        status: "inbox",
        createdAt: new Date().toISOString(),
        repoUrl: "https://github.com/demo/hitlist-app",
      },
      ...prev,
    ]);
  }

  function toggle(task: Task) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: t.status === "done" ? "inbox" : "done",
              doneAt:
                t.status === "done" ? undefined : new Date().toISOString(),
            }
          : t,
      ),
    );
  }

  function remove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function deploy(task: Task) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: "running",
              runStatus: "RUNNING",
              agentUrl: t.agentUrl ?? `https://example.com/agent/${t.id}`,
              dispatchedAt: new Date().toISOString(),
            }
          : t,
      ),
    );
    flash(wasDeployed(task) ? "Redeployed (demo)" : "Agent deployed (demo)");
  }

  function reorderSection(
    nextFlying: Task[],
    nextPending: Task[],
    nextDone: Task[],
  ) {
    setTasks([...nextFlying, ...nextPending, ...nextDone]);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-edge bg-background shadow-2xl shadow-black/60">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <Icon name="crosshair" className="size-4 text-blood" />
          HITLIST
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Demo
        </span>
      </div>

      <div className="px-4 pb-5 pt-4">
        <form onSubmit={add} className="mb-4 flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name your next hit…"
            enterKeyHint="done"
            autoCorrect="off"
            className="min-w-0 flex-1 rounded-xl border border-edge bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-blood"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className={`${BLOOD_BUTTON} px-5`}
          >
            Mark
          </button>
        </form>

        {flying.length > 0 && (
          <>
            <h3 className={SECTION_LABEL}>{flying.length} deployed</h3>
            <TaskList
              tasks={flying}
              onReorder={(next) => reorderSection(next, pending, done)}
              onSelect={() => flash("Open the app for the full sheet")}
              onSelectGroup={() => flash("Groups work in the app")}
              onToggle={toggle}
              onDelete={remove}
              onDeploy={deploy}
              onDraggingChange={() => {}}
            />
          </>
        )}

        {pending.length > 0 && (
          <>
            {flying.length > 0 && (
              <h3 className={SECTION_LABEL}>{pending.length} marked</h3>
            )}
            <TaskList
              tasks={pending}
              onReorder={(next) => reorderSection(flying, next, done)}
              onSelect={() => flash("Open the app for the full sheet")}
              onSelectGroup={() => flash("Groups work in the app")}
              onToggle={toggle}
              onDelete={remove}
              onDeploy={deploy}
              onDraggingChange={() => {}}
            />
          </>
        )}

        {done.length > 0 && (
          <DoneList
            tasks={done}
            onSelect={() => flash("Open the app for the full sheet")}
            onToggle={toggle}
            onDelete={remove}
          />
        )}

        {tasks.length === 0 && (
          <div className="flex flex-col items-center pt-8 pb-4">
            <Icon name="crosshair" className="mb-3 size-10 text-edge" />
            <p className="font-mono text-sm uppercase tracking-widest text-muted">
              No active marks
            </p>
          </div>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
          <div
            role="status"
            className="rounded-xl border border-edge bg-surface px-3 py-2 font-mono text-[11px] uppercase tracking-widest shadow-lg shadow-black/50"
          >
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
