"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRepos } from "@/app/lib/queries";
import { Icon } from "@/app/components/Icons";
import { GithubRepos } from "@/app/components/GithubRepos";

export default function Settings() {
  const { status } = useSession();
  const { data: github } = useRepos(status === "authenticated");
  // ponytail: localStorage, move to /api/settings if it needs to follow the user across devices
  const [blockedRepos, setBlockedRepos] = useState<number[]>([]);

  useEffect(() => {
    setBlockedRepos(JSON.parse(localStorage.getItem("blockedRepos") ?? "[]"));
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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/app"
          aria-label="Back to list"
          className="flex size-10 items-center justify-center rounded-xl border border-edge bg-surface text-muted transition-colors active:bg-background"
        >
          <Icon name="chevron" className="size-4 rotate-90" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>
      <GithubRepos
        repos={github?.repos ?? null}
        connected={github?.connected ?? false}
        blockedRepos={blockedRepos}
        onToggleBlocked={toggleBlocked}
      />
    </main>
  );
}
