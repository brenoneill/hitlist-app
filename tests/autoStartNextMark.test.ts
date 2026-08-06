import { describe, expect, it } from "vitest";
import { nextDeployTargetForRepo } from "@/app/lib/autoStartNextMark";
import { task } from "./helpers/task";

const REPO = "https://github.com/o/r";
const OTHER = "https://github.com/o/other";

describe("nextDeployTargetForRepo", () => {
  it("returns undefined when the merged task has no repo", () => {
    const current = task({ id: "m", title: "merged" });
    expect(nextDeployTargetForRepo([current], current)).toBeUndefined();
  });

  it("picks the next undeployed inbox mark on the same repo", () => {
    const current = task({
      id: "m",
      title: "merged",
      repoUrl: REPO,
      status: "done",
      agentUrl: "https://example.com/a",
    });
    const next = task({ id: "n", title: "next", repoUrl: REPO });
    const otherRepo = task({ id: "x", title: "other", repoUrl: OTHER });
    expect(nextDeployTargetForRepo([current, otherRepo, next], current)).toEqual({
      taskId: "n",
      label: "next",
      isGroup: false,
    });
  });

  it("skips the merged task and its group members", () => {
    const a = task({ id: "a", title: "a", repoUrl: REPO, groupId: "g" });
    const b = task({
      id: "b",
      title: "b",
      repoUrl: REPO,
      groupId: "g",
      status: "done",
      agentUrl: "https://example.com/a",
    });
    const next = task({ id: "n", title: "solo", repoUrl: REPO });
    expect(nextDeployTargetForRepo([a, b, next], b)).toEqual({
      taskId: "n",
      label: "solo",
      isGroup: false,
    });
  });

  it("suggests a whole group when every member is deployable", () => {
    const current = task({
      id: "m",
      title: "merged",
      repoUrl: REPO,
      status: "done",
      agentUrl: "https://example.com/a",
    });
    const g1 = task({ id: "g1", title: "one", repoUrl: REPO, groupId: "g" });
    const g2 = task({ id: "g2", title: "two", repoUrl: REPO, groupId: "g" });
    expect(nextDeployTargetForRepo([current, g1, g2], current)).toEqual({
      taskId: "g1",
      label: "one · two",
      isGroup: true,
    });
  });

  it("skips a group when any member is not deployable", () => {
    const current = task({
      id: "m",
      title: "merged",
      repoUrl: REPO,
      status: "done",
      agentUrl: "https://example.com/a",
    });
    const g1 = task({ id: "g1", title: "one", repoUrl: REPO, groupId: "g" });
    const g2 = task({
      id: "g2",
      title: "two",
      repoUrl: REPO,
      groupId: "g",
      agentUrl: "https://example.com/b",
    });
    const solo = task({ id: "n", title: "solo", repoUrl: REPO });
    expect(nextDeployTargetForRepo([current, g1, g2, solo], current)).toEqual({
      taskId: "n",
      label: "solo",
      isGroup: false,
    });
  });
});
