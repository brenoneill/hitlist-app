"use client";

import { Fragment, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { track } from "@vercel/analytics";
import type { Task } from "@/app/lib/tasks";
import { AutoStartNextMark } from "@/app/components/AutoStartNextMark";
import { BLOOD_BUTTON, Icon, type IconName } from "@/app/components/Icons";
import { Button } from "@/app/components/Button";
import { TaskItem, inFlight, taskItemShellClass } from "@/app/components/TaskItem";
import { FieldLabel } from "@/app/components/ui/FieldLabel";
import { ProviderWishlist } from "@/app/components/ProviderWishlist";
import { UpdatesSignup } from "@/app/components/UpdatesSignup";

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
    title: "Mark phone-sized hits",
    body: "Capture the tasks a phone review can actually finish - before they slip between meetings.",
  },
  {
    icon: "send",
    title: "#dispatch as you type",
    body: "Type -- to tag a GitHub repo, add #dispatch to the title, and the Cursor agent is already running when you hit Mark.",
  },
  {
    icon: "image",
    title: "Visual proof in every PR",
    body: "Require screenshots or video with each dispatch, so you can verify the change without checking out the code.",
  },
  {
    icon: "pr",
    title: "Review & merge in-app",
    body: "PR summary, changed files, deployments, and a merge button - plus agent status and PR links across the whole list.",
  },
  {
    icon: "merge",
    title: "Auto-dispatch the next hit",
    body: "Merge a PR and the next marked hit for that repo dispatches on its own. Your hit list keeps itself moving.",
  },
];

const FLOW: {
  icon: IconName;
  title: string;
  body: string;
}[] = [
  {
    icon: "send",
    title: "Dispatch an agent",
    body: "Mark the hit with #dispatch and a Cursor cloud agent starts working the moment you tap Mark.",
  },
  {
    icon: "pr",
    title: "See the PR",
    body: "The agent opens a pull request with a phone-readable summary and the full diff, linked right on the hit.",
  },
  {
    icon: "image",
    title: "See visual proof",
    body: "Screenshots or video land in the PR, so you can see the change working before you read a line of code.",
  },
  {
    icon: "external",
    title: "Preview the branch",
    body: "Every PR links its preview deployment — open the actual running app on the branch and click around it from your phone. No checkout, no local build.",
  },
  {
    icon: "merge",
    title: "Decide to merge",
    body: "Proof checked, preview clicked — tap merge from the list. The next marked hit for that repo dispatches on its own.",
  },
];

const BENEFITS = [
  {
    title: "The bet: a lot of dev work is phone-sized",
    body: "Our hypothesis is that a growing share of dev work can be finished entirely from a phone. HitList is where you gather those marks and find out which hits agents can actually land.",
  },
  {
    title: "Verify, don’t hope",
    body: "Every dispatch can demand visual proof - screenshots or video in the PR - and a description written to be reviewed on a phone. Built for people who actually test generated code.",
  },
  {
    title: "Every hit is accounted for",
    body: "Status, transcript, follow-ups, PR links, and merges live in one list, so every agent-written change gets reviewed before it ships.",
  },
];

const TRUST = [
  {
    title: "MIT-licensed and free",
    body: "The whole app is open source on GitHub. No plans, no paywall - use ours or run your own.",
  },
  {
    title: "Bring your own Cursor key",
    body: "Agents run on your Cursor account. Your API key is encrypted at rest and only used to dispatch your hits.",
  },
  {
    title: "Your code stays on GitHub",
    body: "Sign-in is identity-only. The GitHub App is scoped to pull requests - it reads diffs to render your review and writes only when you tap merge. HitList never stores your code.",
  },
];

/** One `cta` event per landing button, tagged with where it sits. */
const cta = (where: string) => () => track("cta", { where });

/** Same, for the buttons that also start GitHub sign-in. */
const ctaSignIn = (where: string) => () => {
  track("cta", { where });
  signIn("github");
};

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
      <div aria-hidden className="pointer-events-none absolute -left-[12%] top-[8%] size-[min(28rem,70vw)] rounded-full bg-blood/25 blur-3xl animate-scope will-change-transform" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(237,237,237,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(237,237,237,0.8)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Icon name="crosshair" className="size-5 text-blood" />
          HITLIST
        </span>
        <button type="button" onClick={ctaSignIn("header-signin")} className="font-mono text-[11px] uppercase tracking-widest text-muted transition-colors hover:text-foreground">
          Sign in
        </button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-16">
        <section className="flex min-h-[min(88vh,52rem)] flex-col justify-center py-10">
          <div className="animate-rise">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              HITLIST
            </h1>
            <p className="mt-5 max-w-xl text-3xl font-semibold leading-snug tracking-tight text-foreground/90 sm:text-4xl">The scalable way to dispatch coding agents from your phone</p>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">
              Phone's are terrible for reviewing big chunks of work - but perfect for small, well-scoped tasks. HitList is the place to manage phone-perfect pieces of dev work; on the go.
            </p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-muted">Free · Open source</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button onClick={ctaSignIn("hero-signin")} className="inline-flex items-center gap-2 px-6">
                <Icon name="github" className="size-4" />
                Sign in with GitHub
              </Button>
              <Button href="#preview" onClick={cta("hero-see-list")} variant="outline" className="px-5 text-muted transition-colors hover:border-foreground/30 hover:text-foreground">
                See a hit list
              </Button>
            </div>
          </div>
        </section>

        <section id="preview" className="scroll-mt-8 animate-rise-delay-1 border-t border-edge/80 pt-12">
          <FieldLabel className="mb-2 mt-6 first:mt-0">Preview</FieldLabel>
          <h2 className="text-2xl font-bold tracking-tight">Small enough to review. Ready to dispatch.</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Sign in and this becomes your live hit list - mark a scoped task, tag a repo, or add #dispatch to the title and it’s already running.
          </p>
          <div className="relative mx-auto mt-8 max-w-md">
            <div aria-hidden className="absolute -inset-3 rounded-[1.75rem] bg-blood/10 blur-2xl animate-glow" />
            <PreviewHitList />
            <div className="mt-5 text-center">
              <Button onClick={ctaSignIn("preview-make-it-yours")} className="inline-flex items-center gap-2 px-6">
                <Icon name="github" className="size-4" />
                Make it yours
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-edge/80 pt-12 mt-16">
          <FieldLabel className="mb-2 mt-6 first:mt-0">The flow</FieldLabel>
          <h2 className="text-2xl font-bold tracking-tight">From mark to merge without leaving your phone</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Every step leaves something you can check - a PR, visual proof, and a live preview of the branch - so merging is a decision, not a leap of faith.
          </p>
          <FlowDiagram />
        </section>

        <AutoQueSection />

        <section className="animate-rise-delay-2 border-t border-edge/80 pt-12 mt-16">
          <FieldLabel className="mb-2 mt-6 first:mt-0">Why HitList</FieldLabel>
          <h2 className="text-2xl font-bold tracking-tight">Find the dev work your phone can finish</h2>
          <ul className="mt-8 space-y-8">
            {BENEFITS.map((b) => (
              <li key={b.title}>
                <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <Icon name="check" className="size-4 text-blood" />
                  {b.title}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{b.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-edge/80 pt-12 mt-16">
          <FieldLabel className="mb-2 mt-6 first:mt-0">Features</FieldLabel>
          <h2 className="text-2xl font-bold tracking-tight">Everything you need on one screen</h2>
          <ul className="mt-8 grid gap-8 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <h3 className="flex items-center gap-2 font-semibold tracking-tight">
                  <Icon name={f.icon} className="size-4 text-blood" />
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <ProviderWishlist />

        <section className="border-t border-edge/80 pt-12 mt-16">
          <FieldLabel className="mb-2 mt-6 first:mt-0">Open source</FieldLabel>
          <h2 className="text-2xl font-bold tracking-tight">Free, open source, your keys</h2>
          <ul className="mt-8 space-y-8">
            {TRUST.map((t) => (
              <li key={t.title}>
                <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <Icon name="lock" className="size-4 text-blood" />
                  {t.title}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{t.body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Button
              href="https://github.com/brenoneill/hitlist-app"
              target="_blank"
              rel="noreferrer"
              onClick={cta("open-source-github")}
              variant="outline"
              className="inline-flex items-center gap-2 px-5 text-muted transition-colors hover:border-foreground/30 hover:text-foreground">
              <Icon name="github" className="size-4" />
              View source on GitHub
            </Button>
          </div>
        </section>

        <UpdatesSignup />

        <section className="mt-16 rounded-2xl border border-edge bg-surface/60 px-5 py-10 text-center sm:px-10">
          <Icon name="crosshair" className="mx-auto size-8 text-blood" />
          <h2 className="mt-4 text-2xl font-bold tracking-tight">Put a hit list in your pocket</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">Sign in with GitHub, add your Cursor API key, and start marking the dev work your phone can finish.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={ctaSignIn("footer-get-started")} className="inline-flex items-center gap-2 px-6">
              <Icon name="github" className="size-4" />
              Get started
            </Button>
            <Button href="/app" onClick={cta("footer-open-app")} variant="outline" className="px-5 text-muted transition-colors hover:border-foreground/30 hover:text-foreground">
              Open app
            </Button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-edge/60 py-6 text-center font-mono text-[11px] uppercase tracking-widest text-muted">
        HitList — free & open source ·{" "}
        <a href="https://github.com/brenoneill/hitlist-app" target="_blank" rel="noreferrer" className="underline underline-offset-4 transition-colors hover:text-foreground">
          MIT on GitHub
        </a>
      </footer>
    </div>
  );
}

/**
 * Slim marketing callout for merge → auto-dispatch. Reuses the same
 * AutoStartNextMark control as the live merge dialog (local toggle only).
 */
function AutoQueSection() {
  const [autoStartNext, setAutoStartNext] = useState(true);

  return (
    <section className="border-t border-edge/80 pt-12 mt-16">
      <FieldLabel className="mb-2 mt-6 first:mt-0">Auto-que</FieldLabel>
      <h2 className="text-2xl font-bold tracking-tight">
        Complete the next hit the moment you merge
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
        Leave the checkbox on when you merge and the next marked hit for that
        repo dispatches on its own — no reopening the list to kick it off.
      </p>
      <div className="mt-6 max-w-md rounded-xl border border-edge bg-surface/60 px-4 py-4">
        <p className="mb-1 text-sm font-medium">Execute the merge?</p>
        <p className="mb-3 font-mono text-[11px] text-muted">
          Squash-merges #42 into main.
        </p>
        <AutoStartNextMark
          checked={autoStartNext}
          nextLabel="Polish mark-input hint on first run"
          onChange={setAutoStartNext}
          className="mb-0"
        />
      </div>
    </section>
  );
}

/**
 * Horizontal stepper for the mark-to-merge flow. Auto-advances every few
 * seconds until the visitor taps a step, then stays put.
 */
function FlowDiagram() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % FLOW.length), 1400);
    return () => clearInterval(id);
  }, [paused]);

  const pick = (i: number) => {
    setPaused(true);
    setActive(i);
  };

  return (
    <div className="mt-8">
      <div className="flex items-center">
        {FLOW.map((s, i) => (
          <Fragment key={s.title}>
            {i > 0 && (
              <div aria-hidden className="relative h-px flex-1 bg-edge">
                <div className={`absolute inset-0 origin-left bg-blood transition-transform duration-300 ease-out ${i <= active ? "scale-x-100" : "scale-x-0"}`} />
              </div>
            )}
            <button
              type="button"
              onClick={() => pick(i)}
              aria-label={`Step ${i + 1}: ${s.title}`}
              aria-current={i === active ? "step" : undefined}
              className={`flex size-10 shrink-0 items-center justify-center rounded-full border transition-all duration-300 sm:size-11 ${
                i === active
                  ? "scale-110 border-blood bg-blood/15 text-blood shadow-[0_0_16px_rgba(220,38,38,0.35)]"
                  : i < active
                    ? "border-blood/50 bg-surface text-blood/70"
                    : "border-edge bg-surface text-muted hover:border-foreground/30 hover:text-foreground"
              }`}>
              <Icon name={s.icon} className="size-4" />
            </button>
          </Fragment>
        ))}
      </div>
      <div className="mt-5 h-28 overflow-hidden rounded-xl border border-edge bg-surface/60 px-4 py-3 sm:h-24">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="font-mono text-[11px] text-muted">
            {active + 1}/{FLOW.length}
          </span>
          {FLOW[active].title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{FLOW[active].body}</p>
      </div>
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
    <div aria-hidden className="relative overflow-hidden rounded-2xl border border-edge bg-background shadow-2xl shadow-black/60">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <Icon name="crosshair" className="size-4 text-blood" />
          HITLIST
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">Preview</span>
      </div>

      <div className="px-4 pb-5 pt-4">
        <div className="mb-4 flex gap-2">
          <div className="min-w-0 flex-1 rounded-xl border border-edge bg-surface px-4 py-3 text-base text-muted">Name your next hit… (-- repo, #dispatch)</div>
          <div className={`${BLOOD_BUTTON} px-5 opacity-40`}>Mark</div>
        </div>

        {flying.length > 0 && (
          <>
            <FieldLabel as="h3" className="mb-2 mt-6 first:mt-0">
              {flying.length} dispatched
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
