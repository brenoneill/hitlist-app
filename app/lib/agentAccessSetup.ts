/**
 * Canned "set up agent access" task, created from the repo row in Settings.
 * It rides the normal task→dispatch pipeline: the details become the agent
 * prompt Context, and the agent opens a PR against the user's repo adding a
 * secrets-free demo mode + AGENTS.md. Pure data — imported by a client
 * component, nothing server-only may creep in.
 */

export const SETUP_TASK_TITLE = "Set up agent access (demo mode + agent docs)";

export const SETUP_TASK_DETAILS = `Goal: make this app bootable and signed-in with ZERO real secrets, so coding agents working in sandboxes (no .env, no OAuth callbacks) can run it and verify changes with screenshots.

Build, following this repo's existing stack and conventions:
1. One command (e.g. \`npm run dev:e2e\`, or this stack's equivalent) that boots the app with an in-memory or throwaway local datastore (schema applied, realistic demo data seeded) and any required env vars set to fixed dev-only values inside the script itself — nothing to configure.
2. A demo/test-user sign-in that needs no real credentials (ideally one click, no fields), active ONLY under an explicit env flag that the script sets and production never does. Do not weaken the real auth paths.
3. An AGENTS.md at the repo root (create it, or append to it) documenting the exact steps: the command to run, the URL to open, how to sign in, and which features still need real external credentials and will show empty/error states.

Guardrails: the bypass must be off by default and gated on the env flag; commit no real credentials; change no production behavior.

Before opening the PR, verify it end to end: boot with the new command, sign in as the demo user, and screenshot the logged-in main screen as proof.`;
