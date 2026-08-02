<!-- hitlist-version: 1 -->
<!-- hitlist-run: cursor image-video -->
<!-- hitlist-skills: base visual-cursor-image-video -->

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

### Video (required)

- Also record a short MP4/WebM walkthrough. Save under `/opt/cursor/artifacts/` and embed via ManagePullRequest:
  `<recording_ref src="/opt/cursor/artifacts/<name>.mp4">desc</recording_ref>`
- If recording is blocked, say so and still ship screenshots.
