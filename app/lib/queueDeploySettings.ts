import {
  pickDefaultProvider,
  type ProviderId,
} from "@/app/lib/providerMeta";
import type { VisualConfirmationId } from "@/app/lib/prOptions";
import type { Task } from "@/app/lib/tasks";

/** Deploy settings carried across merge → auto-que (preferred over Settings). */
export type QueueDeploySettings = {
  provider?: ProviderId;
  /** `null` = provider Auto was used on the source Mark. */
  model?: string | null;
  visualConfirmation?: VisualConfirmationId;
};

/**
 * True when the Mark has dispatch settings stored from a prior deploy.
 * `visualConfirmation` is the sentinel — it is written together with `model`
 * on dispatch; legacy rows lack both.
 */
export function taskHasDeploySettings(
  task: Task | undefined | null,
): boolean {
  return !!task?.visualConfirmation;
}

/**
 * Builds auto-que settings from a Mark's last-dispatch fields.
 * @param task - Mark to read; undefined yields undefined.
 * @returns Settings to prefer over user defaults, or undefined when none.
 */
export function queueSettingsFromTask(
  task: Task | undefined | null,
): QueueDeploySettings | undefined {
  if (!task) return undefined;
  const settings: QueueDeploySettings = {};
  if (task.provider) settings.provider = task.provider;
  if (task.visualConfirmation) {
    settings.model = task.model ?? null;
    settings.visualConfirmation = task.visualConfirmation;
  }
  return Object.keys(settings).length ? settings : undefined;
}

/**
 * Picks which Mark's settings auto-que should inherit.
 * Prefer the next Mark when it already has explicit deploy settings; otherwise
 * the merged Mark (queue continuity).
 */
export function pickAutoQueSettings(
  nextTask: Task | undefined | null,
  mergedTask: Task,
): QueueDeploySettings | undefined {
  if (taskHasDeploySettings(nextTask)) {
    return queueSettingsFromTask(nextTask);
  }
  return queueSettingsFromTask(mergedTask);
}

export type DeployDefaultsLike = {
  provider?: ProviderId | null;
  model?: string | null;
  visualConfirmation?: VisualConfirmationId;
};

export type ResolvedQueueDispatch = {
  provider?: ProviderId;
  /** Present when the dispatch body should include `model` (incl. null = Auto). */
  model?: string | null;
  /** When true, send `model` even if null so the server skips Settings default. */
  inheritModel: boolean;
  visualConfirmation?: VisualConfirmationId;
};

/**
 * Resolves provider / model / visual for a merge → auto-que dispatch.
 * Mark settings win per field; user defaults / last-used fill gaps.
 */
export function resolveQueueDeployDispatch(args: {
  settings?: QueueDeploySettings;
  defaults?: DeployDefaultsLike | null;
  configured: ProviderId[];
  lastProvider?: string | null;
}): ResolvedQueueDispatch {
  const { settings, defaults, configured, lastProvider } = args;
  const provider = pickDefaultProvider(
    configured,
    settings?.provider ?? defaults?.provider ?? lastProvider ?? null,
  );
  const inheritModel = settings != null && "model" in settings;
  const model = inheritModel
    ? settings.model
    : (defaults?.model ?? undefined);
  const visualConfirmation =
    settings?.visualConfirmation ?? defaults?.visualConfirmation;
  return { provider, model, inheritModel, visualConfirmation };
}
