"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import {
  useDeployDefaults,
  useDispatchTask,
  useProviderKeys,
} from "@/app/lib/queries";
import {
  LAST_PROVIDER_KEY,
  PROVIDER_IDS,
  pickDefaultProvider,
} from "@/app/lib/providerMeta";
import { optionsForMode } from "@/app/lib/prOptions";
import { useToast } from "@/app/components/ui/Toast";

type QueueAfterMergeArgs = {
  /** Resolves when the merge request has fully finished. */
  mergePromise: Promise<unknown>;
  /** Undeployed Mark (or any group member) to dispatch after merge succeeds. */
  nextTaskId: string;
  /** Checkbox / toast detail (titles joined for groups). */
  nextLabel: string;
  /** True when dispatch expands to a whole group. */
  isGroup: boolean;
};

type DeployQueueValue = {
  /**
   * Shows a global “deploying” toast, awaits merge, then dispatches the next
   * Mark. Safe to call and navigate away — work continues in this provider.
   */
  queueDeployAfterMerge: (args: QueueAfterMergeArgs) => void;
};

const DeployQueueContext = createContext<DeployQueueValue | null>(null);

/**
 * Global merge→deploy handoff. Keeps the dispatch alive across route changes
 * and surfaces progress on the shared toast tray.
 */
export function DeployQueueProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const { data: keys } = useProviderKeys();
  const { data: defaults } = useDeployDefaults();
  const dispatch = useDispatchTask();
  // serialize queued handoffs so two merges don't race the same toast
  const chainRef = useRef<Promise<void>>(Promise.resolve());

  const queueDeployAfterMerge = useCallback(
    ({
      mergePromise,
      nextTaskId,
      nextLabel,
      isGroup,
    }: QueueAfterMergeArgs) => {
      const detail = nextLabel.trim();
      const pending = isGroup
        ? `Dispatching group${detail ? `: ${detail}` : ""}…`
        : `Dispatching ${detail || "next Mark"}…`;
      const done = isGroup ? "Group dispatched" : "Agent dispatched";

      const run = async () => {
        showToast(pending, { sticky: true });
        try {
          await mergePromise;
          const provider = pickDefaultProvider(
            PROVIDER_IDS.filter((p) => keys?.[p]),
            defaults?.provider ??
              (typeof window === "undefined"
                ? null
                : localStorage.getItem(LAST_PROVIDER_KEY)),
          );
          if (provider) localStorage.setItem(LAST_PROVIDER_KEY, provider);

          await new Promise<void>((resolve, reject) => {
            dispatch.mutate(
              {
                id: nextTaskId,
                ...(provider ? { provider } : {}),
                ...(defaults?.model ? { model: defaults.model } : {}),
                ...(defaults?.visualConfirmation
                  ? {
                      options: optionsForMode(defaults.visualConfirmation),
                    }
                  : {}),
              },
              {
                onSuccess: () => resolve(),
                onError: (err) => reject(err),
              },
            );
          });
          showToast(done, { tone: "ok", ms: 4000 });
        } catch (e) {
          showToast(e instanceof Error ? e.message : String(e), {
            tone: "error",
            ms: 8000,
          });
        }
      };

      chainRef.current = chainRef.current.then(run, run);
    },
    [defaults, dispatch, keys, showToast],
  );

  return (
    <DeployQueueContext.Provider value={{ queueDeployAfterMerge }}>
      {children}
    </DeployQueueContext.Provider>
  );
}

/**
 * Access the global merge→deploy queue.
 * @returns queueDeployAfterMerge.
 */
export function useDeployQueue(): DeployQueueValue {
  const ctx = useContext(DeployQueueContext);
  if (!ctx) {
    throw new Error("useDeployQueue must be used within DeployQueueProvider");
  }
  return ctx;
}
