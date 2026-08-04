<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Running the app without secrets (screenshots, E2E)

Agent sandboxes have no `.env.local` and GitHub OAuth cannot complete there —
do not try to sign in with GitHub or fake a session. Instead:

1. `npm install && npm run dev:e2e` — boots with an in-memory Postgres
   (schema applied, demo tasks seeded) and no real secrets required.
2. Open `http://localhost:3000/api/auth/signin` and submit the
   **"Sign in with E2E test user"** form (it has no fields).
3. You are now signed in as the seeded demo user; the main page shows tasks.

This works only under `AUTH_E2E=1` (which `dev:e2e` sets) and touches no real
database. Features needing outside credentials (GitHub repo list, dispatching
real agents) will show empty/error states — say so in the PR instead of
screenshotting around them.
<!-- END:nextjs-agent-rules -->

# Reusable UI components

Design-system chrome lives in `app/components/ui/` (plus `Button` in
`app/components/Button.tsx`). Feature composition stays in `app/components/`
(Sheets, TaskList, GithubRepos, etc.).

- Before adding a new `<input>`, `<textarea>`, `<button>`, menu, chip, label,
  or overlay, reuse or extend the matching primitive (`TextInput`, `Textarea`,
  `FieldLabel`, `Menu`/`MenuItem`, `Chip`, `OverlayDialog`, `ErrorText`,
  `RadioCardGroup`, or `Button`).
- Do not paste long Tailwind class recipes that already exist on a primitive;
  add a variant or a `className` escape hatch instead.
- Extract a new primitive when the same chrome appears in 3+ places (or is
  about to). One-off layouts stay inline in the feature component.
- Prefer extending `Button` variants (`blood`, `ghost`, `outline`, `ok`,
  `info`) over raw `<button className="…rounded-xl border…">` for CTAs.
  Pass `href` when the control should render as a link.
- New form controls must keep shared field chrome (`focus:border-info`,
  disabled opacity) and existing a11y patterns (`aria-*`, `sr-only` labels,
  decorative icons via `Icon` which is already `aria-hidden`).
- Do not add a third-party component library unless explicitly requested.
