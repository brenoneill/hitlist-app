import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children }: { children?: unknown }) => children,
}));

import {
  deployable,
  inFlight,
  redeployable,
  wasDeployed,
} from "@/app/components/TaskItem";
import { task } from "./helpers/task";

describe("TaskItem predicates", () => {
  it("wasDeployed is true when an agentUrl exists", () => {
    expect(wasDeployed(task({ id: "1", title: "t" }))).toBe(false);
    expect(
      wasDeployed(task({ id: "1", title: "t", agentUrl: "https://example.com/a" })),
    ).toBe(true);
  });

  it("deployable is inbox and never dispatched", () => {
    expect(deployable(task({ id: "1", title: "t" }))).toBe(true);
    expect(deployable(task({ id: "1", title: "t", status: "running" }))).toBe(false);
    expect(
      deployable(task({ id: "1", title: "t", agentUrl: "https://example.com/a" })),
    ).toBe(false);
  });

  it("redeployable matches wasDeployed", () => {
    expect(redeployable(task({ id: "1", title: "t" }))).toBe(false);
    expect(
      redeployable(task({ id: "1", title: "t", agentUrl: "https://example.com/a" })),
    ).toBe(true);
  });

  it("inFlight covers running or deployed work that is not archived", () => {
    expect(inFlight(task({ id: "1", title: "t" }))).toBe(false);
    expect(inFlight(task({ id: "1", title: "t", status: "running" }))).toBe(true);
    expect(
      inFlight(
        task({
          id: "1",
          title: "t",
          status: "inbox",
          agentUrl: "https://example.com/a",
        }),
      ),
    ).toBe(true);
    expect(
      inFlight(
        task({
          id: "1",
          title: "t",
          status: "done",
          agentUrl: "https://example.com/a",
        }),
      ),
    ).toBe(false);
  });
});
