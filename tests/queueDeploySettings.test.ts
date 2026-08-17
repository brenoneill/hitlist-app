import { describe, expect, it } from "vitest";
import {
  pickAutoQueSettings,
  queueSettingsFromTask,
  resolveQueueDeployDispatch,
  taskHasDeploySettings,
} from "@/app/lib/queueDeploySettings";
import { task } from "./helpers/task";

describe("queueDeploySettings", () => {
  it("detects explicit Mark deploy settings via visualConfirmation", () => {
    expect(taskHasDeploySettings(task({ id: "a", title: "a" }))).toBe(false);
    expect(
      taskHasDeploySettings(
        task({
          id: "a",
          title: "a",
          model: "gpt",
          visualConfirmation: "image",
        }),
      ),
    ).toBe(true);
  });

  it("reads provider/model/visual from a configured Mark", () => {
    expect(
      queueSettingsFromTask(
        task({
          id: "a",
          title: "a",
          provider: "cursor",
          model: "gpt-5",
          visualConfirmation: "image-video",
        }),
      ),
    ).toEqual({
      provider: "cursor",
      model: "gpt-5",
      visualConfirmation: "image-video",
    });
  });

  it("treats null model as explicit Auto when visualConfirmation is set", () => {
    expect(
      queueSettingsFromTask(
        task({
          id: "a",
          title: "a",
          provider: "cursor",
          model: null,
          visualConfirmation: "none",
        }),
      ),
    ).toEqual({
      provider: "cursor",
      model: null,
      visualConfirmation: "none",
    });
  });

  it("prefers the next Mark's settings over the merged Mark", () => {
    const merged = task({
      id: "merged",
      title: "merged",
      provider: "cursor",
      model: "merged-model",
      visualConfirmation: "image",
    });
    const next = task({
      id: "next",
      title: "next",
      provider: "cursor",
      model: "next-model",
      visualConfirmation: "image-video",
    });
    expect(pickAutoQueSettings(next, merged)).toEqual({
      provider: "cursor",
      model: "next-model",
      visualConfirmation: "image-video",
    });
  });

  it("falls back to the merged Mark when the next Mark has no settings", () => {
    const merged = task({
      id: "merged",
      title: "merged",
      provider: "cursor",
      model: "merged-model",
      visualConfirmation: "image",
    });
    const next = task({ id: "next", title: "next", provider: "cursor" });
    expect(pickAutoQueSettings(next, merged)).toEqual({
      provider: "cursor",
      model: "merged-model",
      visualConfirmation: "image",
    });
  });

  it("resolveQueueDeployDispatch prefers Mark settings over user defaults", () => {
    const resolved = resolveQueueDeployDispatch({
      settings: {
        provider: "cursor",
        model: "mark-model",
        visualConfirmation: "image-video",
      },
      defaults: {
        provider: "cursor",
        model: "settings-model",
        visualConfirmation: "image",
      },
      configured: ["cursor"],
      lastProvider: "cursor",
    });
    expect(resolved).toEqual({
      provider: "cursor",
      model: "mark-model",
      inheritModel: true,
      visualConfirmation: "image-video",
    });
  });

  it("resolveQueueDeployDispatch sends null model so Auto skips Settings", () => {
    const resolved = resolveQueueDeployDispatch({
      settings: {
        provider: "cursor",
        model: null,
        visualConfirmation: "none",
      },
      defaults: {
        provider: "cursor",
        model: "settings-model",
        visualConfirmation: "image",
      },
      configured: ["cursor"],
    });
    expect(resolved.inheritModel).toBe(true);
    expect(resolved.model).toBeNull();
    expect(resolved.visualConfirmation).toBe("none");
  });

  it("resolveQueueDeployDispatch falls back to defaults when Mark has no model", () => {
    const resolved = resolveQueueDeployDispatch({
      settings: { provider: "cursor" },
      defaults: {
        provider: "cursor",
        model: "settings-model",
        visualConfirmation: "image",
      },
      configured: ["cursor"],
    });
    expect(resolved.inheritModel).toBe(false);
    expect(resolved.model).toBe("settings-model");
    expect(resolved.visualConfirmation).toBe("image");
  });
});
