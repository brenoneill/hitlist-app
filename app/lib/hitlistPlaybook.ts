/**
 * HitList playbook bootstrap for cloud-agent kickoffs.
 *
 * Rules live in public/playbook/ (base.md + skills/*.md) and are served
 * composed by app/playbook/[provider]/[mode]/route.ts. The kickoff prompt
 * carries only the task plus one URL to fetch — nothing is installed into
 * the target repo, so there is no version to bump.
 */
import type { ProviderId } from "./providerMeta";
import type { VisualConfirmationId } from "./prOptions";

/**
 * Kickoff preamble: HITLIST_RUN marker + the single composed-playbook URL.
 * @param origin - HitList app origin (e.g. from `new URL(req.url).origin`).
 * @param provider - Agent provider; selects the visual skill.
 * @param mode - Visual confirmation mode; selects the visual skill.
 */
export function playbookBootstrap(
  origin: string,
  provider: ProviderId,
  mode: VisualConfirmationId,
): string {
  const url = `${origin.replace(/\/$/, "")}/playbook/${provider}/${mode}`;
  return `HITLIST_RUN ${provider} ${mode}

Fetch ${url} and follow it for this run.`;
}
