"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRepos } from "@/app/lib/queries";
import { AppHeader } from "@/app/components/AppHeader";
import { GithubRepos } from "@/app/components/GithubRepos";
import { OnboardingWizard } from "@/app/components/OnboardingWizard";

export default function Settings() {
  const { status } = useSession();
  const { data: github, isLoading: reposLoading } = useRepos(
    status === "authenticated",
  );
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
      <AppHeader backHref="/app" title="Settings" hideSettingsLink />

      <GithubRepos
        repos={github?.repos ?? null}
        connected={github?.connected ?? false}
        reposLoading={reposLoading}
        blockedRepos={blockedRepos}
        onToggleBlocked={toggleBlocked}
      />

      <OnboardingWizard />
    </main>
  );
}
