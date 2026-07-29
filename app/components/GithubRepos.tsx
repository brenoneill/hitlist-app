"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { ProviderKeySettings } from "@/app/components/ProviderKeySettings";
import { BLOOD_BUTTON, Icon } from "@/app/components/Icons";
import { PROVIDER_IDS } from "@/app/lib/providerMeta";
import { useProviderKeys } from "@/app/lib/queries";

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

/** Numbered setup step; the chip turns into a check once the step is done. */
function Section({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
            done ? "border-ok text-ok" : "border-edge text-muted"
          }`}
        >
          {done ? <Icon name="check" className="size-3" /> : n}
        </span>
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      {children}
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
  const hasAnyKey = Object.values(keys ?? {}).some(Boolean);
  // Controlled so soft nav / bfcache can't leave the list open; always start collapsed.
  const [reposOpen, setReposOpen] = useState(false);

  if (status === "loading") return null;

  return (
    <div className="mb-6">
      <Section n={1} title="Sign in with GitHub" done={signedIn}>
        {signedIn ? (
          <div className="flex items-center justify-between">
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
        ) : (
          <button
            onClick={() => signIn("github")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge py-3 text-base font-medium active:bg-surface"
          >
            <Icon name="github" className="size-5" />
            Sign in with GitHub
          </button>
        )}
      </Section>

      <Section n={2} title="Connect your repos" done={signedIn && connected}>
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
          <details
            className="group"
            open={reposOpen}
            onToggle={(e) => setReposOpen(e.currentTarget.open)}
          >
            <summary className="mb-3 flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted [&::-webkit-details-marker]:hidden">
              <Icon
                name="chevron"
                className="size-3.5 -rotate-90 transition-transform group-open:rotate-0"
              />
              {blockedRepos.length
                ? `${blockedRepos.length} blocked — hidden from the repo picker`
                : "Tap sensitive repos to block them from the picker"}
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
            <a
              href={MANAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block text-xs text-muted underline underline-offset-4"
            >
              Manage repo access ↗
            </a>
          </details>
        )}
      </Section>

      <Section n={3} title="Add an agent provider" done={signedIn && hasAnyKey}>
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
    </div>
  );
}
