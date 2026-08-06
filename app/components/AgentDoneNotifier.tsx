"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { notifyAgentDone } from "@/app/lib/agentDoneNotifications";
import { useTasks } from "@/app/lib/queries";

/**
 * Watches the shared tasks poll and fires a local OS notification whenever a
 * task leaves `running` for `inbox` or `failed`. Renders nothing.
 */
export function AgentDoneNotifier() {
  const { status } = useSession();
  const { data: tasks } = useTasks();
  // null until first snapshot — seeding must not notify
  const prevRunning = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !tasks) return;

    const running = new Set(
      tasks.filter((t) => t.status === "running").map((t) => t.id),
    );

    if (prevRunning.current === null) {
      prevRunning.current = running;
      return;
    }

    for (const t of tasks) {
      if (
        prevRunning.current.has(t.id) &&
        (t.status === "inbox" || t.status === "failed")
      ) {
        notifyAgentDone(t);
      }
    }
    prevRunning.current = running;
  }, [status, tasks]);

  return null;
}
