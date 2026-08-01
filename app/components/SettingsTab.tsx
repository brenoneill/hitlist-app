import type { Repo } from "@/app/components/GithubRepos";
import { GithubRepos } from "@/app/components/GithubRepos";

interface SettingsTabProps {
  repos: Repo[] | null;
  connected: boolean;
  blockedRepos: number[];
  onToggleBlocked: (id: number) => void;
}

export function SettingsTab({
  repos,
  connected,
  blockedRepos,
  onToggleBlocked,
}: SettingsTabProps) {
  return (
    <GithubRepos
      repos={repos}
      connected={connected}
      blockedRepos={blockedRepos}
      onToggleBlocked={onToggleBlocked}
    />
  );
}
