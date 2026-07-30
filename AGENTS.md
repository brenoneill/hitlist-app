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
