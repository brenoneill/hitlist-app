import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/app/lib/db";
import {
  addTask,
  getTask,
  listTasks,
  removeTask,
  reorderTasks,
  updateTask,
} from "@/app/lib/tasks";
import {
  clearProviderKey,
  getAgentAccessNotes,
  getProviderKey,
  setAgentAccessNotes,
  setProviderKey,
} from "@/app/lib/userSettings";

const U = "smoke-test";
const REPO = "https://github.com/o/r";

describe("DAL (PGlite / AUTH_E2E)", () => {
  beforeAll(async () => {
    await sql`delete from tasks where user_id = ${U}`;
    await sql`delete from user_settings where user_id = ${U}`;
    await sql`delete from repo_settings where user_id = ${U}`;
  });

  it("adds newest-first and reorders with groups", async () => {
    const a = await addTask(U, "a");
    const b = await addTask(U, "b");
    const c = await addTask(U, "c");
    expect((await listTasks(U)).map((t) => t.title)).toEqual(["c", "b", "a"]);

    const list = await reorderTasks(U, [
      { id: a.id, groupId: "g1" },
      { id: c.id, groupId: "g1" },
      { id: b.id, groupId: null },
    ]);
    expect(list.map((t) => t.id)).toEqual([a.id, c.id, b.id]);
    expect((await listTasks(U)).map((t) => t.id)).toEqual([a.id, c.id, b.id]);
    expect((await getTask(U, a.id))!.groupId).toBe("g1");

    // a group of 1 dissolves
    await reorderTasks(U, [
      { id: a.id, groupId: "g2" },
      { id: c.id, groupId: null },
      { id: b.id, groupId: null },
    ]);
    expect((await getTask(U, a.id))!.groupId).toBeUndefined();

    // status done stamps doneAt; explicit-undefined clears a column
    const done = await updateTask(U, b.id, { status: "done" });
    expect(done!.doneAt).toBeTruthy();
    await updateTask(U, b.id, { details: "x" });
    expect((await getTask(U, b.id))!.details).toBe("x");
    expect((await updateTask(U, b.id, { details: undefined }))!.details).toBeUndefined();

    const dispatched = await updateTask(U, b.id, {
      provider: "copilot",
      agentId: "t1",
      model: "gpt-test",
      visualConfirmation: "image-video",
    });
    expect(dispatched!.provider).toBe("copilot");
    expect(dispatched!.agentId).toBe("t1");
    expect(dispatched!.model).toBe("gpt-test");
    expect(dispatched!.visualConfirmation).toBe("image-video");
    const auto = await updateTask(U, b.id, { model: null });
    expect(auto!.model).toBeNull();
    expect(auto!.visualConfirmation).toBe("image-video");

    // user scoping
    expect((await listTasks("smoke-other")).length).toBe(0);
    expect(await updateTask("smoke-other", b.id, { title: "hax" })).toBeUndefined();

    // removing a group member dissolves the leftover group of 1
    await reorderTasks(U, [
      { id: a.id, groupId: "g3" },
      { id: c.id, groupId: "g3" },
      { id: b.id, groupId: null },
    ]);
    await removeTask(U, a.id);
    expect((await getTask(U, c.id))!.groupId).toBeUndefined();
    await removeTask(U, b.id);
    await removeTask(U, c.id);
    expect((await listTasks(U)).length).toBe(0);
  });

  it("encrypts provider keys and scopes them per provider", async () => {
    await sql`delete from user_settings where user_id = ${U}`;
    await setProviderKey(U, "cursor", "crsr_secret_value");
    await setProviderKey(U, "copilot", "ghp_secret_value");
    const [{ cursor_api_key: stored, copilot_api_key: stored2 }] = await sql`
      select cursor_api_key, copilot_api_key from user_settings where user_id = ${U}
    `;
    expect(stored).not.toBe("crsr_secret_value");
    expect(stored2).not.toBe("ghp_secret_value");
    expect(await getProviderKey(U, "cursor")).toBe("crsr_secret_value");
    expect(await getProviderKey(U, "copilot")).toBe("ghp_secret_value");
    await clearProviderKey(U, "cursor");
    expect(await getProviderKey(U, "cursor")).toBeUndefined();
    expect(await getProviderKey(U, "copilot")).toBe("ghp_secret_value");
    await sql`delete from user_settings where user_id = ${U}`;
  });

  it("upserts repo access notes and clears on blank", async () => {
    await sql`delete from repo_settings where user_id = ${U}`;
    await setAgentAccessNotes(U, REPO, "npm run demo; log in as demo/demo");
    await setAgentAccessNotes(U, REPO, "npm run demo2");
    expect(await getAgentAccessNotes(U, REPO)).toBe("npm run demo2");
    expect(await getAgentAccessNotes(U, "https://github.com/o/other")).toBeUndefined();
    await setAgentAccessNotes(U, REPO, "  ");
    expect(await getAgentAccessNotes(U, REPO)).toBeUndefined();
    expect(
      (await sql`select * from repo_settings where user_id = ${U}`).length,
    ).toBe(0);
  });
});
