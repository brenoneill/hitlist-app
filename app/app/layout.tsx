import { AgentDoneNotifier } from "@/app/components/AgentDoneNotifier";

/**
 * App-shell layout: mounts the agent-done notifier for `/app/*` only.
 * @param children - Nested `/app` page content.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AgentDoneNotifier />
    </>
  );
}
