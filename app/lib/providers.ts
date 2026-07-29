// Server-side provider registry. Dispatch/poll/models resolve a client from
// here by ProviderId — never branch on the provider name elsewhere.
import * as copilot from "./copilot";
import * as cursor from "./cursor";
import type { CreatedAgent, CursorModel, LatestRun } from "./cursor";
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
}

export const PROVIDERS = {
  cursor: {
    createAgent: cursor.createAgent,
    getLatestRun: (id, _repo, key) => cursor.getLatestRun(id, key),
    listModels: cursor.listModels,
  },
  copilot,
} satisfies Record<ProviderId, ProviderClient>;
