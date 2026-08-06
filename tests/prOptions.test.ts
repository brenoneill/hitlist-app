import { describe, expect, it } from "vitest";
import { STATE_MAP } from "@/app/lib/copilot";
import type { RunStatus } from "@/app/lib/cursor";
import {
  DEFAULT_PR_OPTIONS,
  DEFAULT_VISUAL_CONFIRMATION,
  optionsForMode,
  resolveVisualConfirmation,
} from "@/app/lib/prOptions";

describe("prOptions", () => {
  it("defaults to image-only confirmation", () => {
    expect(DEFAULT_PR_OPTIONS).toEqual(["image"]);
    expect(DEFAULT_VISUAL_CONFIRMATION).toBe("image");
  });

  it("resolves empty, unknown, and known modes predictably", () => {
    expect(resolveVisualConfirmation(undefined)).toBe("image");
    expect(resolveVisualConfirmation(["bogus"])).toBe("image");
    expect(resolveVisualConfirmation([])).toBe("none");
    expect(resolveVisualConfirmation(["image-video"])).toBe("image-video");
  });

  it("maps modes to option arrays for the playbook", () => {
    expect(optionsForMode("image")).toEqual(["image"]);
    expect(optionsForMode("none")).toEqual([]);
  });
});

describe("Copilot STATE_MAP", () => {
  it("maps every documented Copilot state into RunStatus", () => {
    const RUN_STATUSES: RunStatus[] = [
      "CREATING",
      "RUNNING",
      "FINISHED",
      "ERROR",
      "CANCELLED",
      "EXPIRED",
    ];
    const COPILOT_STATES = [
      "queued",
      "in_progress",
      "completed",
      "failed",
      "cancelled",
      "timed_out",
      "waiting_for_user",
      "idle",
    ] as const;

    for (const s of COPILOT_STATES) {
      expect(RUN_STATUSES, `unmapped copilot state: ${s}`).toContain(STATE_MAP[s]);
    }
  });
});
