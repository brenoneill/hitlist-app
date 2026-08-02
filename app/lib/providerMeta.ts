// Client-safe provider metadata — no fetch clients here (they stay server-side
// in providers.ts). Adding a provider: add an entry here, a client module, a
// registry entry in providers.ts, and a key column in userSettings.ts.
export const PROVIDER_META = {
  cursor: {
    label: "Cursor",
    icon: "cursor",
    blurb: "Cloud agents via your Cursor API key",
    docsUrl: "https://cursor.com/dashboard?tab=integrations",
    placeholder: "Your Cursor API key…",
    /** Whether the workspace composer can send in-app follow-ups (providers.ts trio). */
    supportsFollowups: true,
  },
  copilot: {
    label: "GitHub Copilot",
    icon: "copilot",
    blurb: "Cloud agents via a fine-grained GitHub PAT",
    docsUrl: "https://github.com/settings/personal-access-tokens/new",
    placeholder: "Fine-grained PAT with Agent tasks…",
    supportsFollowups: false,
  },
} as const;

export type ProviderId = keyof typeof PROVIDER_META;

/**
 * One-shot setup tips shown after a provider key is saved. Dismissed via
 * localStorage (`storageKey`); `highlight` is the setting/domain to call out.
 */
export const PROVIDER_TIPS: Partial<
  Record<
    ProviderId,
    {
      storageKey: string;
      href: string;
      linkLabel: string;
      before: string;
      highlight: string;
      after: string;
    }
  >
> = {
  cursor: {
    storageKey: "cursorArtifactsGithubTipDone",
    href: "https://cursor.com/dashboard/cloud-agents#my-pull-requests",
    linkLabel: "Open Cursor settings ↗",
    before: "Turn on",
    highlight: "Allow posting artifacts to GitHub",
    after: "so screenshots show up inline in PRs.",
  },
};

/** localStorage key prefix — append repo URL for per-repo Copilot allowlist tip. */
export const COPILOT_ALLOWLIST_TIP_PREFIX = "copilotAllowlistTip:";

/**
 * Deep link to a repo’s Copilot coding-agent custom allowlist settings.
 * @param ownerRepo - `owner/repo` (GitHub `full_name`).
 */
export function copilotAllowlistUrl(ownerRepo: string): string {
  return `https://github.com/${ownerRepo}/settings/copilot/coding_agent/allowlist`;
}

/** localStorage key for the last provider a dispatch was sent to. */
export const LAST_PROVIDER_KEY = "lastProvider";

export const PROVIDER_IDS = Object.keys(PROVIDER_META) as ProviderId[];

/** Last-used provider if still configured, else the first configured one. */
export function pickDefaultProvider(
  configured: ProviderId[],
  last: string | null,
): ProviderId | undefined {
  return configured.find((p) => p === last) ?? configured[0];
}
