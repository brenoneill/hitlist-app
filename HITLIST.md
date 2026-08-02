<!-- hitlist-version: 1 -->
<!-- hitlist-run: cursor image -->
<!-- hitlist-skills: base visual-cursor-image -->

# HitList agent playbook

Follow this file when the task prompt includes `HITLIST_RUN`.

## Working agreement

- Keep changes focused on this task; don't refactor unrelated code.
- Follow the repo's existing patterns and conventions.
- If anything is ambiguous, pick the simplest reasonable interpretation and note the assumption in the PR description.
- Open a PR with a clear summary of what changed and why.
## Visual confirmation

Login screens: use Repo access notes / Context / AGENTS.md; else say what you couldn't capture. Don't forge sessions.

### Acceptance criteria (required)

- Capture screenshots proving each change works.
- Save under `/opt/cursor/artifacts/` (do not commit). Embed in the PR description via ManagePullRequest:
  `<img src="/opt/cursor/artifacts/<name>.png" alt="desc">`
