import { sql } from "./db";
import { newId } from "./id";

/** One turn of an agent conversation, keyed by the provider agent id. */
export interface TaskMessage {
  id: string;
  agentId: string;
  role: "user" | "agent";
  body: string;
  /** Provider run id — set on agent replies, used to dedupe sync. */
  runId?: string;
  createdAt: string;
}

function rowToMessage(r: Record<string, unknown>): TaskMessage {
  return {
    id: r.id as string,
    agentId: r.agent_id as string,
    role: r.role as TaskMessage["role"],
    body: r.body as string,
    runId: (r.run_id as string) ?? undefined,
    createdAt: (r.created_at as Date).toISOString(),
  };
}

export async function listMessages(
  userId: string,
  agentId: string,
): Promise<TaskMessage[]> {
  const rows = await sql`
    select * from task_messages
    where user_id = ${userId} and agent_id = ${agentId}
    order by created_at, id
  `;
  return rows.map(rowToMessage);
}

/**
 * Records a conversation turn. Agent replies pass `runId` (insert is idempotent
 * per run) and `createdAt` (the run's start time, so backfilled replies sort
 * between the prompts that caused them).
 */
export async function addMessage(
  userId: string,
  agentId: string,
  role: TaskMessage["role"],
  body: string,
  opts?: { runId?: string; createdAt?: string },
): Promise<void> {
  await sql`
    insert into task_messages (id, user_id, agent_id, role, body, run_id, created_at)
    values (
      ${newId()}, ${userId}, ${agentId}, ${role}, ${body},
      ${opts?.runId ?? null}, ${opts?.createdAt ?? new Date().toISOString()}
    )
    on conflict (run_id) do nothing
  `;
}
