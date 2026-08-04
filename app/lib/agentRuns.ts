import { TERMINAL_RUN, type RunStatus } from "./cursor";
import { sql } from "./db";
import { newId } from "./id";
import type { ProviderId } from "./providerMeta";

export type AgentRunKind = "dispatch" | "followup" | "redeploy";

/**
 * Inserts a new analytics row when a run starts (dispatch, redeploy, or follow-up).
 * @param opts.userId - Owning user.
 * @param opts.taskId - Task that triggered the run (dispatch route id).
 * @param opts.agentId - Provider agent id.
 * @param opts.provider - Agent provider.
 * @param opts.model - Model id used at dispatch, or null/undefined for Auto.
 * @param opts.kind - How this run was started.
 * @returns Nothing; caller should swallow errors so analytics never blocks deploy.
 */
export async function startRun(opts: {
  userId: string;
  taskId: string;
  agentId: string;
  provider: ProviderId;
  model?: string | null;
  kind: AgentRunKind;
}): Promise<void> {
  const now = new Date().toISOString();
  // Follow-up is only allowed once the task sees a terminal run; close any
  // still-open analytics row so the next poll can't finish the wrong one.
  if (opts.kind === "followup") {
    await sql`
      update agent_runs set
        finished_at = coalesce(finished_at, ${now}::timestamptz),
        status = coalesce(status, 'FINISHED')
      where user_id = ${opts.userId}
        and agent_id = ${opts.agentId}
        and finished_at is null
    `;
  }
  await sql`
    insert into agent_runs (
      id, user_id, task_id, agent_id, provider, model, kind, status, started_at
    )
    values (
      ${newId()},
      ${opts.userId},
      ${opts.taskId},
      ${opts.agentId},
      ${opts.provider},
      ${opts.model ?? null},
      ${opts.kind},
      ${opts.kind === "followup" ? "RUNNING" : "CREATING"},
      ${now}
    )
  `;
}

/**
 * Updates the open (or known) run from a provider poll: attaches `provider_run_id`,
 * refreshes status, and sets `finished_at` once when the run becomes terminal.
 * @param opts.userId - Owning user.
 * @param opts.agentId - Provider agent id.
 * @param opts.provider - Agent provider.
 * @param opts.providerRunId - Provider run id when known.
 * @param opts.status - Latest RunStatus from the provider.
 */
export async function touchRunFromPoll(opts: {
  userId: string;
  agentId: string;
  provider: ProviderId;
  providerRunId?: string;
  status: RunStatus;
}): Promise<void> {
  const finished = TERMINAL_RUN.has(opts.status);
  const now = new Date().toISOString();
  const providerRunId = opts.providerRunId ?? null;

  const open = await sql`
    update agent_runs set
      status = ${opts.status},
      finished_at = case
        when ${finished} and finished_at is null then ${now}::timestamptz
        else finished_at
      end
    where id = (
      select id from agent_runs
      where user_id = ${opts.userId}
        and agent_id = ${opts.agentId}
        and finished_at is null
      order by started_at desc
      limit 1
    )
    returning id, provider_run_id
  `;
  if (open.length) {
    // Attach provider run id only when free — avoids unique conflicts if a
    // stale latestRunId still points at the previous finished run.
    if (providerRunId && !open[0].provider_run_id) {
      await sql`
        update agent_runs set provider_run_id = ${providerRunId}
        where id = ${open[0].id as string}
          and provider_run_id is null
          and not exists (
            select 1 from agent_runs r
            where r.provider = ${opts.provider}
              and r.provider_run_id = ${providerRunId}
          )
      `;
    }
    return;
  }

  if (!providerRunId) return;
  await sql`
    update agent_runs set
      status = ${opts.status},
      finished_at = case
        when ${finished} and finished_at is null then ${now}::timestamptz
        else finished_at
      end
    where user_id = ${opts.userId}
      and provider = ${opts.provider}
      and provider_run_id = ${providerRunId}
  `;
}
