"use client";

import { signIn } from "next-auth/react";
import type { Task } from "@/app/lib/tasks";
import { BLOOD_BUTTON, Icon, type IconName } from "@/app/components/Icons";
import { Button } from "@/app/components/Button";
import {
  TaskItem,
  inFlight,
  taskItemShellClass,
} from "@/app/components/TaskItem";
import { FieldLabel } from "@/app/components/ui/FieldLabel";

const DEMO_SEED: Task[] = [
  {
    id: "demo-1",
    title: "Add empty-state copy for the mark list",
    status: "inbox",
    createdAt: "2026-07-31T10:00:00.000Z",
    repoUrl: "https://github.com/demo/hitlist-app",
  },
  {
    id: "demo-2",
    title: "Polish mark-input hint on first run",
    status: "running",
    createdAt: "2026-07-31T10:05:00.000Z",
    repoUrl: "https://github.com/demo/hitlist-app",
    agentUrl: "agent",
    runStatus: "RUNNING",
    dispatchedAt: "2026-07-31T10:06:00.000Z",
  },
  {
    id: "demo-3",
    title: "Fix favicon flash on cold start",
    status: "inbox",
    createdAt: "2026-07-31T09:30:00.000Z",
    repoUrl: "https://github.com/demo/docs",
    agentUrl: "agent",
    prUrl: "pr",
    prState: "open",
  },
  {
    id: "demo-4",
    title: "Remove unused toast styles from the list",
    status: "done",
    createdAt: "2026-07-30T18:00:00.000Z",
    doneAt: "2026-07-30T19:00:00.000Z",
    mergedAt: "2026-07-30T19:00:00.000Z",
    prUrl: "pr",
    prState: "merged",
    agentUrl: "agent",
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
    body: "Capture the small tasks you can review well in a PR — before they slip between meetings.",
  },
  {
    icon: "github",
    title: "Tag a repo",
    body: "Type -- in the mark field to pin a GitHub repo. The agent already knows where to work.",
  },
  {
    icon: "cursor",
    title: "Deploy a cloud agent",
    body: "Hand the hit to Cursor or Copilot from your phone. Come back when the PR is ready to review.",
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
    body: "Running a major agent session from mobile is rough. Marking a small, reviewable hit and dispatching it isn’t.",
  },
  {
    title: "Thought → agent → PR",
    body: "Capture the task, tag the repo, fire an agent provider, and review the pull request from the same list.",
  },
  {
    title: "Keep the big work elsewhere",
    body: "Save deep refactors for a real machine. Use HitList for scoped changes that make a clean PR review.",
  },
];

/**
 * Marketing landing for signed-out visitors, with a static hit-list preview
 * that reuses TaskItem from the app.
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
        className="pointer-events-none absolute -left-[12%] top-[8%] size-[min(28rem,70vw)] rounded-full bg-blood/25 blur-3xl animate-scope will-change-transform"
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
              small tasks you can review well in a PR — mark them, tag a repo,
              and fire a web agent while you’re on the go.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => signIn("github")}
                className="inline-flex items-center gap-2 px-6"
              >
                <Icon name="github" className="size-4" />
                Sign in with GitHub
              </Button>
              <Button
                href="#preview"
                variant="outline"
                className="px-5 text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                See a hit list
              </Button>
            </div>
          </div>
        </section>

        <section
          id="preview"
          className="scroll-mt-8 animate-rise-delay-1 border-t border-edge/80 pt-12"
        >
          <FieldLabel className="mb-2 mt-6 first:mt-0">Preview</FieldLabel>
          <h2 className="text-2xl font-bold tracking-tight">
            Small enough to review. Ready to dispatch.
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Sign in and this becomes your live queue — mark a scoped task, tag a
            repo, and fire an agent before you’re back at a desk.
          </p>
          <div className="relative mx-auto mt-8 max-w-md">
            <div
              aria-hidden
              className="absolute -inset-3 rounded-[1.75rem] bg-blood/10 blur-2xl animate-glow"
            />
            <PreviewHitList />
            <div className="mt-5 text-center">
              <Button
                onClick={() => signIn("github")}
                className="inline-flex items-center gap-2 px-6"
              >
                <Icon name="github" className="size-4" />
                Make it yours
              </Button>
            </div>
          </div>
        </section>

        <section className="animate-rise-delay-2 border-t border-edge/80 pt-12 mt-16">
          <FieldLabel className="mb-2 mt-6 first:mt-0">Why HitList</FieldLabel>
          <h2 className="text-2xl font-bold tracking-tight">
            Built for reviewable PRs, not sprawling refactors
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
          <FieldLabel className="mb-2 mt-6 first:mt-0">Features</FieldLabel>
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
            <Button
              onClick={() => signIn("github")}
              className="inline-flex items-center gap-2 px-6"
            >
              <Icon name="github" className="size-4" />
              Get started
            </Button>
            <Button
              href="/app"
              variant="outline"
              className="px-5 text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              Open app
            </Button>
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
 * Static hit-list chrome for the landing page. Rows use the shared TaskItem
 * with inert links so nothing navigates away.
 */
function PreviewHitList() {
  const flying = DEMO_SEED.filter(inFlight);
  const pending = DEMO_SEED.filter((t) => t.status !== "done" && !inFlight(t));
  const done = DEMO_SEED.filter((t) => t.status === "done");

  return (
    <div
      aria-hidden
      className="relative overflow-hidden rounded-2xl border border-edge bg-background shadow-2xl shadow-black/60"
    >
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <Icon name="crosshair" className="size-4 text-blood" />
          HITLIST
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Preview
        </span>
      </div>

      <div className="px-4 pb-5 pt-4">
        <div className="mb-4 flex gap-2">
          <div className="min-w-0 flex-1 rounded-xl border border-edge bg-surface px-4 py-3 text-base text-muted">
            Name your next hit…
          </div>
          <div className={`${BLOOD_BUTTON} px-5 opacity-40`}>Mark</div>
        </div>

        {flying.length > 0 && (
          <>
            <FieldLabel as="h3" className="mb-2 mt-6 first:mt-0">
              {flying.length} deployed
            </FieldLabel>
            <ul className="flex flex-col gap-2">
              {flying.map((t) => (
                <li key={t.id}>
                  <div className={taskItemShellClass()}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <TaskItem task={t} links="inert" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {pending.length > 0 && (
          <>
            {flying.length > 0 && (
              <FieldLabel as="h3" className="mb-2 mt-6 first:mt-0">
                {pending.length} marked
              </FieldLabel>
            )}
            <ul className="flex flex-col gap-2">
              {pending.map((t) => (
                <li key={t.id}>
                  <div className={taskItemShellClass()}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <TaskItem task={t} links="inert" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {done.length > 0 && (
          <div className="mt-4">
            <FieldLabel className="flex items-center gap-2 py-2">
              <Icon name="chevron" className="size-4" aria-hidden />
              {done.length} executed
            </FieldLabel>
            <ul className="flex flex-col gap-2 pt-2">
              {done.map((t) => (
                <li key={t.id}>
                  <div className={taskItemShellClass()}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <TaskItem task={t} links="inert" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
