"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { CursorKeySettings } from "@/app/components/CursorKeySettings";

export interface Repo {
  id: number;
  name: string;
  url: string;
  private: boolean;
}

const INSTALL_URL = `https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/new`;
const MANAGE_URL = "https://github.com/settings/installations";

export function GithubRepos({
  repos,
  connected,
}: {
  repos: Repo[] | null;
  connected: boolean;
}) {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return (
      <button
        onClick={() => signIn("github")}
        className="mb-6 w-full rounded-xl border border-black/10 py-3 text-base font-medium dark:border-white/15"
      >
        Sign in with GitHub
      </button>
    );
  }

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-zinc-500">
          {session?.user?.name ?? session?.user?.email}
        </span>
        <button
          onClick={() => signOut()}
          className="text-sm text-zinc-500 underline"
        >
          Sign out
        </button>
      </div>

      <CursorKeySettings />

      {!connected ? (
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
          <p className="mb-3 text-sm text-zinc-500">
            Connect GitHub to pick which repos HitList can see. We only ever
            request read-only access to a repo&apos;s name and URL — never its
            code.
          </p>
          <a
            href={INSTALL_URL}
            className="block w-full rounded-xl bg-foreground py-3 text-center text-base font-medium text-background active:opacity-70"
          >
            Connect repos on GitHub
          </a>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Metadata-only access, no code read
            </span>
            <a
              href={MANAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 underline"
            >
              Manage repo access ↗
            </a>
          </div>
          {!repos || repos.length === 0 ? (
            <p className="text-zinc-500">No repos shared yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {repos.map((repo) => (
                <li key={repo.id}>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-black/10 px-4 py-3 text-sm dark:border-white/15"
                  >
                    {repo.name}
                    {repo.private && (
                      <span className="ml-2 text-xs text-zinc-500">
                        private
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
