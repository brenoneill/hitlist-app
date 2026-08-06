import { describe, expect, it } from "vitest";
import { normalizeGroups } from "@/app/lib/groups";
import { task } from "./helpers/task";

describe("normalizeGroups", () => {
  it("keeps groups with two or more members", () => {
    const tasks = [
      task({ id: "a", title: "a", groupId: "g1" }),
      task({ id: "b", title: "b", groupId: "g1" }),
      task({ id: "c", title: "c" }),
    ];
    expect(normalizeGroups(tasks).map((t) => t.groupId)).toEqual([
      "g1",
      "g1",
      undefined,
    ]);
  });

  it("dissolves a group of one back to a plain task", () => {
    const tasks = [
      task({ id: "a", title: "a", groupId: "g1" }),
      task({ id: "b", title: "b" }),
    ];
    expect(normalizeGroups(tasks)[0].groupId).toBeUndefined();
  });
});
