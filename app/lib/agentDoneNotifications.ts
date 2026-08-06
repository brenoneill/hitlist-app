import type { Task } from "@/app/lib/tasks";
import { isStandalone } from "@/app/lib/usePwaInstall";

/** localStorage flag — `"1"` means the user opted in from Settings. */
export const AGENT_DONE_NOTIFICATIONS_KEY = "agentDoneNotifications";

/**
 * Whether the user opted in to agent-done OS notifications.
 * @returns true when localStorage stores `"1"`.
 */
export function readAgentDoneNotifications(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AGENT_DONE_NOTIFICATIONS_KEY) === "1";
}

/**
 * Persists the agent-done notification opt-in.
 * @param on - When true, store `"1"`; when false, clear the key.
 */
export function writeAgentDoneNotifications(on: boolean): void {
  if (on) localStorage.setItem(AGENT_DONE_NOTIFICATIONS_KEY, "1");
  else localStorage.removeItem(AGENT_DONE_NOTIFICATIONS_KEY);
}

/**
 * Whether this session can show an agent-done notification right now.
 * @returns true when Notification API is granted, user opted in, and standalone.
 */
export function canNotifyAgentDone(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted" &&
    readAgentDoneNotifications() &&
    isStandalone()
  );
}

/**
 * Shows a persistent OS notification for a task whose agent run just finished.
 * @param task - Task that left `running` for `inbox` or `failed`.
 */
export function notifyAgentDone(task: Task): void {
  if (!canNotifyAgentDone()) return;
  const failed = task.status === "failed";
  const n = new Notification(failed ? "Agent failed" : "Agent finished", {
    body: task.title,
    tag: `agent-done-${task.id}-${Date.now()}`,
  });
  n.onclick = () => {
    window.focus();
    window.location.href = `/app/task/${task.id}`;
    n.close();
  };
}
