"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { CursorKeySettings } from "@/app/components/CursorKeySettings";
import { BLOOD_BUTTON, Icon } from "@/app/components/Icons";

export interface Repo {
  id: number;
  name: string;
  url: string;
  private: boolean;
}

const APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
const INSTALL_URL = APP_SLUG
  ? `https://github.com/apps/${APP_SLUG}/installations/new`
  : "";
const MANAGE_URL = "https://github.com/settings/installations";

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

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return (
      <button
        onClick={() => signIn("github")}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 text-base font-medium active:bg-surface"
      >
        <Icon name="github" className="size-5" />
        Sign in with GitHub
      </button>
    );
  }

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted">
          {session?.user?.name ?? session?.user?.email}
        </span>
        <button
          onClick={() => signOut()}
          className="text-sm text-muted underline underline-offset-4"
        >
          Sign out
        </button>
      </div>

      <CursorKeySettings />

      {!connected ? (
        <div className="rounded-xl border border-edge bg-surface p-4">
          <p className="mb-3 text-sm text-muted">
            Connect GitHub to pick which repos HitList can see. We only ever
            request read-only access to a repo&apos;s name and URL — never its
            code.
          </p>
          {INSTALL_URL ? (
            <a
              href={INSTALL_URL}
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
        <details className="group">
          <summary className="mb-3 flex cursor-pointer list-none items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="transition-transform group-open:rotate-90">
                ›
              </span>
              {blockedRepos.length
                ? `${blockedRepos.length} blocked — hidden from the repo picker`
                : "Tap sensitive repos to block them from the picker"}
            </span>
            <a
              href={MANAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-muted underline underline-offset-4"
            >
              Manage repo access ↗
            </a>
          </summary>
          {!repos || repos.length === 0 ? (
            <p className="font-mono text-sm text-muted">No repos shared yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {repos.map((repo) => {
                const blocked = blockedRepos.includes(repo.id);
                return (
                  <li
                    key={repo.id}
                    className={`flex items-center gap-2 rounded-xl border bg-surface px-4 py-3 font-mono text-sm ${
                      blocked ? "border-blood" : "border-edge"
                    }`}
                  >
                    <button
                      onClick={() => onToggleBlocked(repo.id)}
                      aria-pressed={blocked}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <Icon
                        name={blocked ? "x" : "crosshair"}
                        className={`size-4 shrink-0 ${
                          blocked ? "text-blood" : "text-muted"
                        }`}
                      />
                      <span className="min-w-0 truncate">
                        {repo.name}
                        {repo.private && (
                          <span className="ml-2 text-xs text-muted">
                            private
                          </span>
                        )}
                      </span>
                    </button>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${repo.name} on GitHub`}
                    >
                      <Icon
                        name="external"
                        className="size-3.5 shrink-0 text-muted"
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </details>
      )}
    </div>
  );
}
