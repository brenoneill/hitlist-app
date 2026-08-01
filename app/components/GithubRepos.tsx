"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { ProviderKeySettings } from "@/app/components/ProviderKeySettings";
import { BLOOD_BUTTON, Icon } from "@/app/components/Icons";
import { Button } from "@/app/components/Button";
import {
  SETUP_TASK_DETAILS,
  SETUP_TASK_TITLE,
} from "@/app/lib/agentAccessSetup";
import {
  useAddTask,
  useModels,
  useProviderKeys,
  useRepoNotes,
  useSaveDeployDefaults,
  useSaveRepoNotes,
  useDeployDefaults,
} from "@/app/lib/queries";
import { DEFAULT_VISUAL_CONFIRMATION } from "@/app/lib/prOptions";
import {
  LAST_PROVIDER_KEY,
  PROVIDER_IDS,
  PROVIDER_META,
  pickDefaultProvider,
  type ProviderId,
} from "@/app/lib/providerMeta";
import { deployDefaultsChips } from "@/app/lib/deployDefaultsLabel";
import { ModelSelect } from "@/app/components/ModelSelect";
import { ProviderRadio } from "@/app/components/ProviderRadio";
import { VisualConfirmationRadio } from "@/app/components/VisualConfirmationRadio";

export interface Repo {
  id: number;
  name: string;
  url: string;
  private: boolean;
  /** Whether access notes are saved — the text itself loads when a row opens. */
  hasNotes: boolean;
}

const APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
const INSTALL_URL = APP_SLUG
  ? `https://github.com/apps/${APP_SLUG}/installations/new`
  : "";
const MANAGE_URL = "https://github.com/settings/installations";
/** Rows shown before "show more" — keeps step 3 reachable on a phone. */
const VISIBLE_CAP = 5;

/**
 * Expanded repo row: notes injected into every dispatch prompt for this repo, a
 * one-click canned task that sends an agent to build a secrets-free demo mode in
 * the repo itself, and the picker visibility toggle. Mounted only while open, so
 * the notes fetch is lazy and edits reset on close.
 */
function RepoAccessPanel({
  repo,
  blocked,
  onToggleBlocked,
}: {
  repo: Repo;
  blocked: boolean;
  onToggleBlocked: () => void;
}) {
  const { data } = useRepoNotes(repo.url);
  const save = useSaveRepoNotes();
  const addTask = useAddTask();
  // null until typed in, so the server value can arrive without a seeding effect
  const [draft, setDraft] = useState<string | null>(null);
  const notes = draft ?? data?.notes ?? "";
  const dirty = !!data && notes.trim() !== data.notes.trim();

  return (
    <div className="border-t border-edge px-4 py-3">
      <label htmlFor={`notes-${repo.id}`} className="text-xs font-medium">
        Agent access notes
      </label>
      <p className="mt-0.5 text-xs text-muted">
        How to run this app and get past login for screenshots — a demo command,
        a staging URL, test credentials. Added to every agent prompt for this
        repo.
      </p>
      <textarea
        id={`notes-${repo.id}`}
        value={notes}
        onChange={(e) => setDraft(e.target.value)}
        disabled={!data}
        rows={3}
        placeholder={
          !data
            ? "Loading…"
            : "npm run dev:demo\nlog in as demo@example.com / demo123"
        }
        className="mt-2 w-full resize-none rounded-xl border border-edge bg-background p-3 font-mono text-xs outline-none placeholder:text-muted focus:border-blood disabled:opacity-50"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => save.mutate({ repoUrl: repo.url, notes })}
          disabled={!dirty || save.isPending}
          className="rounded-lg border border-edge px-3 py-1.5 text-xs active:bg-background disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : "Save notes"}
        </button>
        {save.isSuccess && !dirty && (
          <span className="flex items-center gap-1 text-xs text-ok">
            <Icon name="check" className="size-3" />
            Saved
          </span>
        )}
        {save.error && (
          <span className="text-xs text-blood">
            {save.error.message || "save failed"}
          </span>
        )}
      </div>

      <div className="mt-3 border-t border-edge pt-3">
        <button
          type="button"
          onClick={() =>
            addTask.mutate({
              title: SETUP_TASK_TITLE,
              details: SETUP_TASK_DETAILS,
              repoUrl: repo.url,
            })
          }
          disabled={addTask.isPending || addTask.isSuccess}
          className="rounded-lg border border-edge px-3 py-1.5 text-xs active:bg-background disabled:opacity-40"
        >
          {addTask.isSuccess ? "Added to your list ✓" : "Add setup task"}
        </button>
        <p className="mt-2 text-xs text-muted">
          No demo mode yet? This sends an agent to add a secrets-free demo login
          + AGENTS.md to the repo — review and deploy it from your list.
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-edge pt-3">
        <button
          type="button"
          onClick={onToggleBlocked}
          aria-pressed={blocked}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs active:bg-background ${
            blocked ? "border-blood/50 text-blood" : "border-edge"
          }`}
        >
          <Icon name={blocked ? "check" : "x"} className="size-3" />
          {blocked ? "Hidden from picker" : "Hide from picker"}
        </button>
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 text-xs text-muted underline underline-offset-4"
        >
          <Icon name="external" className="size-3" />
          GitHub
        </a>
      </div>
    </div>
  );
}

/** Collapsed row: name plus the one state line that matters for this repo. */
function RepoRow({
  repo,
  blocked,
  open,
  onToggleOpen,
  onToggleBlocked,
}: {
  repo: Repo;
  blocked: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onToggleBlocked: () => void;
}) {
  const state = blocked
    ? "Hidden from picker"
    : repo.hasNotes
      ? "Access notes set"
      : "No access notes";
  return (
    <li
      className={`overflow-hidden rounded-xl border bg-surface ${
        blocked ? "border-blood/40" : "border-edge"
      }`}
    >
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-background"
      >
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background ${
            blocked ? "border-blood/40 text-blood" : "border-edge text-muted"
          }`}
        >
          <Icon name={blocked ? "x" : "crosshair"} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`flex items-center gap-1.5 truncate font-mono text-sm ${
              blocked ? "text-muted" : ""
            }`}
          >
            <span className="truncate">{repo.name}</span>
            {repo.private && (
              <span className="shrink-0" title="Private repo">
                <Icon name="lock" className="size-3 text-muted" />
                <span className="sr-only">Private repo</span>
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span
              className={`size-1.5 shrink-0 rounded-full ${
                blocked ? "bg-blood" : repo.hasNotes ? "bg-ok" : "bg-edge"
              }`}
            />
            {state}
          </span>
        </span>
        <Icon
          name="chevron"
          className={`size-4 shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <RepoAccessPanel
          repo={repo}
          blocked={blocked}
          onToggleBlocked={onToggleBlocked}
        />
      )}
    </li>
  );
}

function RepoList({
  repos,
  blockedRepos,
  onToggleBlocked,
}: {
  repos: Repo[];
  blockedRepos: number[];
  onToggleBlocked: (id: number) => void;
}) {
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  // one panel at a time, so a long list stays scannable
  const [openId, setOpenId] = useState<number | null>(null);
  const q = filter.trim().toLowerCase();
  const matches = q
    ? repos.filter((r) => r.name.toLowerCase().includes(q))
    : repos;
  const visible = showAll || q ? matches : matches.slice(0, VISIBLE_CAP);
  const hidden = repos.filter((r) => blockedRepos.includes(r.id)).length;

  if (repos.length === 0) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-4">
        <p className="text-sm text-muted">
          Connected, but no repos are shared yet —{" "}
          <a
            href={MANAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            pick some on GitHub ↗
          </a>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="text-sm">
          {repos.length} {repos.length === 1 ? "repo" : "repos"} connected
          {hidden > 0 && <span className="text-muted"> · {hidden} hidden</span>}
        </p>
        <a
          href={MANAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-muted underline underline-offset-4"
        >
          Manage on GitHub ↗
        </a>
      </div>
      <p className="mb-3 text-xs text-muted">
        Open a repo to give agents access notes, or to hide it from the picker.
      </p>

      {repos.length > VISIBLE_CAP && (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter repos…"
          aria-label="Filter repos"
          className="mb-2 w-full rounded-xl border border-edge bg-background px-4 py-2.5 text-base outline-none placeholder:text-muted focus:border-blood"
        />
      )}

      {visible.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          No repos match &ldquo;{filter.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((repo) => (
            <RepoRow
              key={repo.id}
              repo={repo}
              blocked={blockedRepos.includes(repo.id)}
              open={openId === repo.id}
              onToggleOpen={() =>
                setOpenId(openId === repo.id ? null : repo.id)
              }
              onToggleBlocked={() => onToggleBlocked(repo.id)}
            />
          ))}
        </ul>
      )}

      {matches.length > visible.length && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 w-full rounded-xl border border-edge py-2.5 text-xs text-muted active:bg-surface"
        >
          Show {matches.length - visible.length} more
        </button>
      )}
    </>
  );
}

/**
 * Numbered setup step; the chip turns into a check once the step is done.
 * Collapsible steps fold themselves once, the first time `done` turns true —
 * after that the user's own toggling always wins. `summary` renders in place
 * of `children` while folded (e.g. a one-line status readout).
 * `disabled` mutes the step and blocks expand/collapse (used before sign-in).
 */
function Section({
  n,
  title,
  done,
  collapsible = true,
  disabled = false,
  summary,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  collapsible?: boolean;
  disabled?: boolean;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const autoFolded = useRef(false);

  useEffect(() => {
    if (!collapsible || autoFolded.current || !done) return;
    autoFolded.current = true;
    setOpen(false);
  }, [collapsible, done]);

  // Disabled steps stay open on the lock message; otherwise fold like before.
  const expanded = disabled || !collapsible || open;
  const chip = (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
        done ? "border-ok text-ok" : "border-edge text-muted"
      }`}
    >
      {done ? <Icon name="check" className="size-3" /> : n}
    </span>
  );

  return (
    <section
      className={`mb-6 ${disabled ? "opacity-50" : ""}`}
      aria-disabled={disabled || undefined}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setOpen((o) => !o);
          }}
          aria-expanded={expanded}
          disabled={disabled}
          className="mb-3 flex w-full items-center gap-2 text-left disabled:cursor-not-allowed"
        >
          {chip}
          <h2 className="flex-1 text-sm font-medium">{title}</h2>
          {!disabled && (
            <Icon
              name="chevron"
              className={`size-4 shrink-0 text-muted transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          )}
        </button>
      ) : (
        <div className="mb-3 flex items-center gap-2">
          {chip}
          <h2 className="text-sm font-medium">{title}</h2>
        </div>
      )}
      {expanded ? children : summary}
    </section>
  );
}

export function GithubRepos({
  repos,
  connected,
  blockedRepos,
  onToggleBlocked,
}: {
  repos: Repo[] | null;
  connected: boolean;
  blockedRepos: number[];
  onToggleBlocked: (id: number) => void;
}) {
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated";
  const { data: keys } = useProviderKeys(signedIn);
  const { data: defaults } = useDeployDefaults(signedIn);
  const saveDefaults = useSaveDeployDefaults();
  const hasAnyKey = Object.values(keys ?? {}).some(Boolean);
  const configured = PROVIDER_IDS.filter((p) => keys?.[p]);
  // Defaults only unlock after both setup steps; until then the section stays hidden.
  const defaultsReady = signedIn && hasAnyKey && connected;
  // While unsigned, Sign in is step 1 (pinned at the bottom); later steps are 2/3 and disabled.
  // After sign-in, provider/repos become 1/2 and defaults (when ready) is 3 at the top.
  const providerStep = signedIn ? 1 : 2;
  const reposStep = signedIn ? 2 : 3;
  const defaultProvider =
    pickDefaultProvider(
      configured,
      defaults?.provider ??
        (typeof window === "undefined"
          ? null
          : localStorage.getItem(LAST_PROVIDER_KEY)),
    ) ?? configured[0];
  const { data: models, isLoading: modelsLoading } = useModels(
    defaultProvider,
    signedIn && !!defaultProvider,
  );
  const visualConfirmation =
    defaults?.visualConfirmation ?? DEFAULT_VISUAL_CONFIRMATION;
  const defaultModel = defaults?.model ?? "";
  const repoCount = repos?.length ?? 0;

  if (status === "loading") return null;

  const providerSummary = (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {PROVIDER_IDS.map((p) => (
        <span key={p} className="flex items-center gap-1.5">
          <span
            className={`size-1.5 shrink-0 rounded-full ${
              keys?.[p] ? "bg-ok" : "bg-edge"
            }`}
          />
          {PROVIDER_META[p].label}
        </span>
      ))}
    </p>
  );

  const reposSummary = (
    <p className="text-xs text-muted">
      {connected
        ? `${repoCount} ${repoCount === 1 ? "repo" : "repos"} connected`
        : "No repos connected"}
    </p>
  );

  const defaultsChips = deployDefaultsChips({
    provider: defaultProvider,
    modelId: defaultModel || null,
    modelName: models?.find((m) => m.id === defaultModel)?.displayName,
    visualConfirmation,
    showProvider: configured.length > 1,
  });

  const defaultsSummary = (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {defaultsChips.map((chip) => (
        <span key={chip.label} className="flex items-center gap-1.5">
          <Icon name={chip.icon} className="size-3 shrink-0" />
          {chip.label}
        </span>
      ))}
    </p>
  );

  function setDefaultProvider(next: ProviderId) {
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_PROVIDER_KEY, next);
    }
    saveDefaults.mutate({ provider: next });
  }

  return (
    <div className="mb-6">
      {/* 3 — deploy defaults (top only once provider + repos are connected) */}
      {defaultsReady && (
        <Section n={3} title="Default options" done summary={defaultsSummary}>
          <p className="mb-3 text-sm text-muted">
            Used when you deploy. Override per run in the action sheet.
          </p>
          {configured.length > 1 && (
            <>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">
                Provider
              </p>
              <ProviderRadio
                providers={configured}
                value={defaultProvider}
                onChange={setDefaultProvider}
                className="mb-3"
              />
            </>
          )}
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">
            Model
          </p>
          <ModelSelect
            value={defaultModel}
            onChange={(next) =>
              saveDefaults.mutate({ model: next.trim() ? next : null })
            }
            models={models}
            loading={modelsLoading}
            disabled={!defaultProvider}
            className="mb-3"
          />
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">
            Visual confirmation
          </p>
          <VisualConfirmationRadio
            value={visualConfirmation}
            onChange={(next) =>
              saveDefaults.mutate({ visualConfirmation: next })
            }
          />
          {saveDefaults.error && (
            <p className="mt-2 font-mono text-xs text-blood">
              {saveDefaults.error.message || "save failed"}
            </p>
          )}
        </Section>
      )}

      {/* 1/2 — provider (disabled until signed in) */}
      <Section
        n={providerStep}
        title="Add an agent provider"
        done={signedIn && hasAnyKey}
        disabled={!signedIn}
        summary={providerSummary}
      >
        {!signedIn ? (
          <p className="text-sm text-muted">Sign in first.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              Add a key for at least one provider — it&apos;s who does the work
              when you deploy an agent.
            </p>
            {PROVIDER_IDS.map((p) => (
              <ProviderKeySettings key={p} provider={p} />
            ))}
          </>
        )}
      </Section>

      {/* 2/3 — repos (disabled until signed in) */}
      <Section
        n={reposStep}
        title="Connect your repos"
        done={signedIn && connected}
        disabled={!signedIn}
        summary={reposSummary}
      >
        {!signedIn ? (
          <p className="text-sm text-muted">Sign in first.</p>
        ) : !connected ? (
          <div className="rounded-xl border border-edge bg-surface p-4">
            <p className="mb-3 text-sm text-muted">
              Connect GitHub to pick which repos HitList can see. We only ever
              request read-only access to a repo&apos;s name and URL — never its
              code.
            </p>
            {INSTALL_URL ? (
              <a
                href={INSTALL_URL}
                // GitHub redirects installs to the App's one registered Setup
                // URL (production). Send our origin as `state` so the callback
                // can bounce back here when we're a preview deployment.
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `${INSTALL_URL}?state=${encodeURIComponent(window.location.origin)}`;
                }}
                className={`${BLOOD_BUTTON} block w-full text-center`}
              >
                Connect repos on GitHub
              </a>
            ) : (
              <p className="font-mono text-xs text-muted">
                Set NEXT_PUBLIC_GITHUB_APP_SLUG to enable connecting.
              </p>
            )}
          </div>
        ) : (
          <RepoList
            repos={repos ?? []}
            blockedRepos={blockedRepos}
            onToggleBlocked={onToggleBlocked}
          />
        )}
      </Section>

      {/* Account — step 1 while unsigned; name + Sign out footer once signed in */}
      {signedIn ? (
        <div className="mb-6 flex items-center justify-between border-t border-edge pt-4">
          <span className="text-sm text-muted">
            {session?.user?.name ?? session?.user?.email}
          </span>
          <Button
            variant="ghost"
            onClick={() => signOut()}
            className="text-sm"
          >
            Sign out
          </Button>
        </div>
      ) : (
        <Section n={1} title="Sign in with GitHub" done={false} collapsible={false}>
          <button
            onClick={() => signIn("github")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 text-base font-medium active:bg-surface"
          >
            <Icon name="github" className="size-5" />
            Sign in with GitHub
          </button>
        </Section>
      )}
    </div>
  );
}
