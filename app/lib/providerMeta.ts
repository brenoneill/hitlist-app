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
  },
  copilot: {
    label: "GitHub Copilot",
    icon: "copilot",
    blurb: "Cloud agents via a fine-grained GitHub PAT",
    docsUrl: "https://github.com/settings/personal-access-tokens/new",
    placeholder: "Fine-grained PAT with Agent tasks…",
  },
} as const;

/** Cursor dashboard toggle for embedding agent screenshots in GitHub PRs. */
export const CURSOR_ARTIFACTS_GITHUB_URL =
  "https://cursor.com/dashboard/cloud-agents#my-pull-requests";

/** localStorage flag — user dismissed the Cursor artifacts tip. */
export const CURSOR_ARTIFACTS_TIP_KEY = "cursorArtifactsGithubTipDone";

export type ProviderId = keyof typeof PROVIDER_META;

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
