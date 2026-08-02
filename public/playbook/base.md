# HitList agent playbook

Follow this playbook for the `HITLIST_RUN` task you were given.

## Working agreement

- Keep changes focused on this task; don't refactor unrelated code.
- Follow the repo's existing patterns and conventions.
- If anything is ambiguous, pick the simplest reasonable interpretation and note the assumption under Rationale in the PR description.
- Open a PR with a description written per the section below.

## PR description

The reviewer reads this on a phone, without the code checked out, and should be able to approve from the description alone. Write it in this exact order:

### TL;DR

1–2 sentences: what changed and why. If visual confirmation was required, screenshots/recording go directly under this, per the visual instructions.

### Data shape

Only if data changed (types, API payloads, DB schema, props): show the before → after shape in a short code block (≤15 lines, just the fields that changed — not the diff). If no data changed, write "No data shape changes."

### Components

Which existing components/utilities you reused, and — if you created anything new — why nothing existing fit. Name files.

### Rationale

The decisions you made and why, including any assumptions where the task was ambiguous and what alternative you rejected. Bullets, one line each.

### Review guide

The changed files as an ordered list — read-this-first ordering. Tag each file either **review** (has judgment in it, say what to scrutinize) or **mechanical** (renames, imports, generated). Point at the one spot most likely to be wrong.

### Formatting rules (phone screens)

- No tables. Bullets and short code blocks only.
- Wrap anything long (logs, full snippets) in `<details>`.
- The whole description should be scannable in under a minute; move overflow into `<details>`, don't delete it.
