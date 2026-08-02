// Server-side provider registry. Dispatch/poll/models resolve a client from
// here by ProviderId — never branch on the provider name elsewhere.
import * as copilot from "./copilot";
import * as cursor from "./cursor";
import type { AgentRun, CreatedAgent, CursorModel, LatestRun } from "./cursor";
import type { ProviderId } from "./providerMeta";

export interface ProviderClient {
  createAgent(
    text: string,
    repoUrl: string,
    ref: string | undefined,
    apiKey: string,
    modelId?: string,
  ): Promise<CreatedAgent>;
  /** repoUrl: Copilot's GET is repo-scoped; Cursor ignores it. */
  getLatestRun(
    agentId: string,
    repoUrl: string | undefined,
    apiKey: string,
  ): Promise<LatestRun | undefined>;
  listModels(apiKey: string): Promise<CursorModel[]>;
  // Conversation trio — absent means the provider can't do in-app follow-ups
  // (mirror any change in PROVIDER_META.supportsFollowups, which gates the UI).
  /** Follow-up prompt into the agent's existing conversation. */
  sendFollowup?(agentId: string, text: string, apiKey: string): Promise<void>;
  listRuns?(agentId: string, apiKey: string): Promise<AgentRun[]>;
  /** A terminated run's final assistant reply text. */
  getRunResult?(
    agentId: string,
    runId: string,
    apiKey: string,
  ): Promise<string | undefined>;
}

export const PROVIDERS = {
  cursor: {
    createAgent: cursor.createAgent,
    getLatestRun: (id, _repo, key) => cursor.getLatestRun(id, key),
    listModels: cursor.listModels,
    sendFollowup: cursor.sendFollowup,
    listRuns: cursor.listRuns,
    getRunResult: cursor.getRunResult,
  },
  copilot,
} satisfies Record<ProviderId, ProviderClient>;
