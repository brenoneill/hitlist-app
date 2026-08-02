/**
 * HitList playbook bootstrap for cloud-agent kickoffs.
 *
 * Layout under public/playbook/:
 * - base.md — always included (working agreement)
 * - skills/*.md — optional supplements selected from dispatch context
 *
 * Bump HITLIST_MD_VERSION when any playbook file changes (agent refreshes HITLIST.md).
 */
import type { ProviderId } from "./providerMeta";
import type { VisualConfirmationId } from "./prOptions";

/** Bump when any file under public/playbook/ changes. */
export const HITLIST_MD_VERSION = 1;

export const AGENTS_HITLIST_POINTER =
  "When the task prompt includes HITLIST_RUN, also read and follow HITLIST.md.";

export interface PlaybookPart {
  /** Stable id written into HITLIST.md `hitlist-skills` header. */
  id: string;
  /** Public URL path (under /public). */
  path: string;
}

/**
 * Ordered playbook parts for this dispatch: base + skills from selections.
 * Add more skills here as new deploy options appear.
 * @param provider - Agent provider id.
 * @param mode - Visual confirmation mode id.
 */
export function playbookParts(
  provider: ProviderId,
  mode: VisualConfirmationId,
): PlaybookPart[] {
  return [
    { id: "base", path: "/playbook/base.md" },
    {
      id: `visual-${provider}-${mode}`,
      path: `/playbook/skills/visual-${provider}-${mode}.md`,
    },
  ];
}

/**
 * Absolute URLs for the ordered playbook parts.
 * @param origin - Request origin (e.g. from `new URL(req.url).origin`).
 * @param parts - Parts from `playbookParts`.
 */
export function playbookPartUrls(
  origin: string,
  parts: readonly PlaybookPart[],
): string[] {
  const base = origin.replace(/\/$/, "");
  return parts.map((p) => `${base}${p.path}`);
}

/**
 * Kickoff preamble: HITLIST_RUN + fetch base + selected skills into HITLIST.md.
 * @param origin - HitList app origin used to fetch playbook parts.
 * @param provider - Agent provider; selects visual skill.
 * @param mode - Visual confirmation mode; selects visual skill.
 */
export function playbookBootstrap(
  origin: string,
  provider: ProviderId,
  mode: VisualConfirmationId,
): string {
  const parts = playbookParts(provider, mode);
  const urls = playbookPartUrls(origin, parts);
  const run = `${provider} ${mode}`;
  const skills = parts.map((p) => p.id).join(" ");
  const fetchList = urls.map((u, i) => `   ${i + 1}. ${u}`).join("\n");

  return `HITLIST_RUN ${run}

## HitList playbook
1. If root \`HITLIST.md\` is missing, its \`hitlist-version\` is below ${HITLIST_MD_VERSION}, or its \`hitlist-skills\` is not \`${skills}\`, rebuild it:
   - Fetch these URLs in order:
${fetchList}
   - Write repo-root \`HITLIST.md\` as:
     \`\`\`
     <!-- hitlist-version: ${HITLIST_MD_VERSION} -->
     <!-- hitlist-run: ${run} -->
     <!-- hitlist-skills: ${skills} -->

     \`\`\`
     followed by the fetched bodies concatenated in that same order (overwrite any previous file).
2. Ensure \`AGENTS.md\` contains exactly: \`${AGENTS_HITLIST_POINTER}\` (create the file or append if missing).
3. Read \`HITLIST.md\` and follow it for this run.
4. Include any playbook file changes in this PR — do not open a separate PR for them.`;
}
