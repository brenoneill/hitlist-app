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
import { getCursorApiKey, setCursorApiKey } from "../app/lib/userSettings";

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

// cursor api key round-trips through AES-GCM and isn't stored in the clear
await sql`delete from user_settings where user_id = ${U}`;
await setCursorApiKey(U, "crsr_secret_value");
const [{ cursor_api_key: stored }] = await sql`
  select cursor_api_key from user_settings where user_id = ${U}
`;
assert.notEqual(stored, "crsr_secret_value");
assert.equal(await getCursorApiKey(U), "crsr_secret_value");
await sql`delete from user_settings where user_id = ${U}`;

console.log("smoke ok");
