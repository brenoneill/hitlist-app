<!-- hitlist-version: 1 -->
<!-- hitlist-run: copilot image -->
<!-- hitlist-skills: base visual-copilot-image -->

## Visual confirmation

Login screens: use Repo access notes / Context / AGENTS.md; else say what you couldn't capture. Don't forge sessions.

### Acceptance criteria (required)

- Capture screenshots proving each change works.
- If `hitlist-apps/` already exists, delete it first (leftover from a prior PR) so only this run's files are committed.
- Commit screenshots under `hitlist-apps/` (no capture scripts). Embed in the PR description:
  `![desc](hitlist-apps/<name>.png)`
# HitList agent playbook

Follow this file when the task prompt includes `HITLIST_RUN`.

## Working agreement

- Keep changes focused on this task; don't refactor unrelated code.
- Follow the repo's existing patterns and conventions.
- If anything is ambiguous, pick the simplest reasonable interpretation and note the assumption in the PR description.
- Open a PR with a clear summary of what changed and why.
