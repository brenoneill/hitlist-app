// Runnable check for the only non-trivial DAL logic: position/group persistence,
// clear-on-undefined patches, doneAt stamping, user scoping. Runs against
// whatever DATABASE_URL points at (use the dev branch) under a throwaway user.
// Usage: NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local scripts/smoke.ts
// (the react-server condition makes the DAL's `server-only` import a no-op)
import assert from "node:assert/strict";
import { sql } from "../app/lib/db";
import {
  addTask,
  getTask,
  listTasks,
  removeTask,
  reorderTasks,
  updateTask,
} from "../app/lib/tasks";
import {
  clearProviderKey,
  getAgentAccessNotes,
  getProviderKey,
  setAgentAccessNotes,
  setProviderKey,
} from "../app/lib/userSettings";
import { DEFAULT_PR_OPTIONS, optionSections } from "../app/lib/prOptions";
import { STATE_MAP } from "../app/lib/copilot";
import type { RunStatus } from "../app/lib/cursor";

// PR option selection: defaults are image-only; provider picks embed path
const REPO = "https://github.com/o/r";
assert.deepEqual(DEFAULT_PR_OPTIONS, ["image"]);
assert.equal(optionSections(DEFAULT_PR_OPTIONS, "cursor").length, 1);
assert.equal(optionSections(["bogus"], "cursor").length, 1); // unknown → default image
assert.equal(optionSections([], "cursor").length, 1);
assert.ok(optionSections([], "cursor")[0].includes("None required"));
assert.ok(optionSections(["image"], "cursor")[0].includes("/opt/cursor/artifacts"));
assert.ok(optionSections(["image"], "copilot")[0].includes("hitlist-apps"));

const U = "smoke-test";
await sql`delete from tasks where user_id = ${U}`;

// addTask unshifts: newest first
const a = await addTask(U, "a");
const b = await addTask(U, "b");
const c = await addTask(U, "c");
assert.deepEqual(
  (await listTasks(U)).map((t) => t.title),
  ["c", "b", "a"],
);

// reorder + group round-trips through the DB
const list = await reorderTasks(U, [
  { id: a.id, groupId: "g1" },
  { id: c.id, groupId: "g1" },
  { id: b.id, groupId: null },
]);
assert.deepEqual(
  list.map((t) => t.id),
  [a.id, c.id, b.id],
);
assert.deepEqual(
  (await listTasks(U)).map((t) => t.id),
  [a.id, c.id, b.id],
);
assert.equal((await getTask(U, a.id))!.groupId, "g1");

// a group of 1 dissolves (normalizeGroups)
await reorderTasks(U, [
  { id: a.id, groupId: "g2" },
  { id: c.id, groupId: null },
  { id: b.id, groupId: null },
]);
assert.equal((await getTask(U, a.id))!.groupId, undefined);

// status done stamps doneAt; explicit-undefined clears a column
const done = await updateTask(U, b.id, { status: "done" });
assert.ok(done!.doneAt);
await updateTask(U, b.id, { details: "x" });
assert.equal((await getTask(U, b.id))!.details, "x");
assert.equal((await updateTask(U, b.id, { details: undefined }))!.details, undefined);

// provider + agentId persist through updateTask (dispatch writes these)
const dispatched = await updateTask(U, b.id, { provider: "copilot", agentId: "t1" });
assert.equal(dispatched!.provider, "copilot");
assert.equal(dispatched!.agentId, "t1");

// user scoping
assert.equal((await listTasks("smoke-other")).length, 0);
assert.equal(await updateTask("smoke-other", b.id, { title: "hax" }), undefined);

// removing a group member dissolves the leftover group of 1
await reorderTasks(U, [
  { id: a.id, groupId: "g3" },
  { id: c.id, groupId: "g3" },
  { id: b.id, groupId: null },
]);
await removeTask(U, a.id);
assert.equal((await getTask(U, c.id))!.groupId, undefined);
await removeTask(U, b.id);
await removeTask(U, c.id);
assert.equal((await listTasks(U)).length, 0);

// provider keys round-trip through AES-GCM, aren't stored in the clear, and
// are independent per provider (clearing one leaves the other)
await sql`delete from user_settings where user_id = ${U}`;
await setProviderKey(U, "cursor", "crsr_secret_value");
await setProviderKey(U, "copilot", "ghp_secret_value");
const [{ cursor_api_key: stored, copilot_api_key: stored2 }] = await sql`
  select cursor_api_key, copilot_api_key from user_settings where user_id = ${U}
`;
assert.notEqual(stored, "crsr_secret_value");
assert.notEqual(stored2, "ghp_secret_value");
assert.equal(await getProviderKey(U, "cursor"), "crsr_secret_value");
assert.equal(await getProviderKey(U, "copilot"), "ghp_secret_value");
await clearProviderKey(U, "cursor");
assert.equal(await getProviderKey(U, "cursor"), undefined);
assert.equal(await getProviderKey(U, "copilot"), "ghp_secret_value");
await sql`delete from user_settings where user_id = ${U}`;

// repo access notes: upsert round-trip, per-repo scoping, blank clears the row
await sql`delete from repo_settings where user_id = ${U}`;
await setAgentAccessNotes(U, REPO, "npm run demo; log in as demo/demo");
await setAgentAccessNotes(U, REPO, "npm run demo2");
assert.equal(await getAgentAccessNotes(U, REPO), "npm run demo2");
assert.equal(await getAgentAccessNotes(U, "https://github.com/o/other"), undefined);
await setAgentAccessNotes(U, REPO, "  ");
assert.equal(await getAgentAccessNotes(U, REPO), undefined);
assert.equal((await sql`select * from repo_settings where user_id = ${U}`).length, 0);

// every documented Copilot state maps into the stored RunStatus union
const RUN_STATUSES: RunStatus[] = [
  "CREATING", "RUNNING", "FINISHED", "ERROR", "CANCELLED", "EXPIRED",
];
const COPILOT_STATES = [
  "queued", "in_progress", "completed", "failed",
  "cancelled", "timed_out", "waiting_for_user", "idle",
];
for (const s of COPILOT_STATES) {
  assert.ok(RUN_STATUSES.includes(STATE_MAP[s]), `unmapped copilot state: ${s}`);
}

console.log("smoke ok");
