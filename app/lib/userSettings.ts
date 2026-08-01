import { sql } from "./db";
import { decrypt, encrypt } from "./crypto";
import { PROVIDER_IDS, type ProviderId } from "./providerMeta";
import {
  DEFAULT_VISUAL_CONFIRMATION,
  isVisualConfirmationId,
  type VisualConfirmationId,
} from "./prOptions";

/** Persisted deploy defaults from Settings (provider / model / visual confirmation). */
export type DeployDefaults = {
  provider: ProviderId | null;
  model: string | null;
  visualConfirmation: VisualConfirmationId;
};

/** Provider → key column. Column names come only from this map — no injection. */
const KEY_COLS: Record<ProviderId, string> = {
  cursor: "cursor_api_key",
  copilot: "copilot_api_key",
};

export async function getProviderKey(
  userId: string,
  provider: ProviderId,
): Promise<string | undefined> {
  const col = KEY_COLS[provider];
  const rows = await sql.query(
    `select ${col} from user_settings where user_id = $1`,
    [userId],
  );
  const encrypted = (rows[0] as Record<string, string> | undefined)?.[col];
  return encrypted ? decrypt(encrypted) : undefined;
}

export async function setProviderKey(
  userId: string,
  provider: ProviderId,
  apiKey: string,
): Promise<void> {
  const col = KEY_COLS[provider];
  await sql.query(
    `insert into user_settings (user_id, ${col}) values ($1, $2)
     on conflict (user_id) do update set ${col} = excluded.${col}`,
    [userId, encrypt(apiKey)],
  );
}

/** Clears one provider's key; leaves other settings (e.g. GitHub install) intact. */
export async function clearProviderKey(
  userId: string,
  provider: ProviderId,
): Promise<void> {
  await sql.query(
    `update user_settings set ${KEY_COLS[provider]} = null where user_id = $1`,
    [userId],
  );
}

/** Which providers have a key stored — one row read. */
export async function getProviderKeyFlags(
  userId: string,
): Promise<Record<ProviderId, boolean>> {
  const rows = await sql`
    select cursor_api_key, copilot_api_key from user_settings
    where user_id = ${userId}
  `;
  return {
    cursor: !!rows[0]?.cursor_api_key,
    copilot: !!rows[0]?.copilot_api_key,
  };
}

/** Per-repo instructions injected into the dispatch prompt (plain text). */
export async function getAgentAccessNotes(
  userId: string,
  repoUrl: string,
): Promise<string | undefined> {
  const rows = await sql`
    select agent_access_notes from repo_settings
    where user_id = ${userId} and repo_url = ${repoUrl}
  `;
  return rows[0]?.agent_access_notes ?? undefined;
}

/** Repo URLs that have notes saved — one read, drives the settings list state. */
export async function listReposWithNotes(userId: string): Promise<string[]> {
  const rows = await sql`
    select repo_url from repo_settings where user_id = ${userId}
  `;
  return rows.map((r) => r.repo_url as string);
}

export async function setAgentAccessNotes(
  userId: string,
  repoUrl: string,
  notes: string,
): Promise<void> {
  if (!notes.trim()) {
    await sql`
      delete from repo_settings
      where user_id = ${userId} and repo_url = ${repoUrl}
    `;
    return;
  }
  await sql`
    insert into repo_settings (user_id, repo_url, agent_access_notes)
    values (${userId}, ${repoUrl}, ${notes})
    on conflict (user_id, repo_url) do update
      set agent_access_notes = excluded.agent_access_notes
  `;
}

export async function getGithubInstallationId(
  userId: string,
): Promise<string | undefined> {
  const rows = await sql`
    select github_installation_id from user_settings where user_id = ${userId}
  `;
  return rows[0]?.github_installation_id ?? undefined;
}

export async function setGithubInstallationId(
  userId: string,
  githubInstallationId: string,
): Promise<void> {
  await sql`
    insert into user_settings (user_id, github_installation_id)
    values (${userId}, ${githubInstallationId})
    on conflict (user_id) do update
      set github_installation_id = excluded.github_installation_id
  `;
}

/**
 * Ensures deploy-default columns exist. Preview/prod Neon branches often predate
 * schema.sql; without this, GET/PUT /api/settings/defaults 500s and Settings
 * shows a bare "save failed".
 */
let deployDefaultsReady: Promise<boolean> | undefined;
function ensureDeployDefaultColumns(): Promise<boolean> {
  return (deployDefaultsReady ??= (async () => {
    try {
      await sql`
        alter table user_settings
          add column if not exists default_provider text
      `;
      await sql`
        alter table user_settings
          add column if not exists default_model text
      `;
      return true;
    } catch {
      deployDefaultsReady = undefined;
      return false;
    }
  })());
}

/**
 * User's default visual confirmation for agent PRs.
 * @param userId - Signed-in user id.
 * @returns Stored mode, or the built-in default when unset.
 */
export async function getVisualConfirmation(
  userId: string,
): Promise<VisualConfirmationId> {
  return (await getDeployDefaults(userId)).visualConfirmation;
}

/**
 * Persists the default visual confirmation mode.
 * @param userId - Signed-in user id.
 * @param mode - image-video | image | none.
 */
export async function setVisualConfirmation(
  userId: string,
  mode: VisualConfirmationId,
): Promise<void> {
  await setDeployDefaults(userId, { visualConfirmation: mode });
}

/**
 * User's deploy defaults (provider, model, visual confirmation).
 * @param userId - Signed-in user id.
 * @returns Stored defaults with built-in fallbacks for unset fields.
 */
export async function getDeployDefaults(
  userId: string,
): Promise<DeployDefaults> {
  const hasCols = await ensureDeployDefaultColumns();
  if (!hasCols) {
    const rows = await sql`
      select visual_confirmation from user_settings where user_id = ${userId}
    `;
    const value = rows[0]?.visual_confirmation;
    return {
      provider: null,
      model: null,
      visualConfirmation:
        typeof value === "string" && isVisualConfirmationId(value)
          ? value
          : DEFAULT_VISUAL_CONFIRMATION,
    };
  }
  const rows = await sql`
    select default_provider, default_model, visual_confirmation
    from user_settings where user_id = ${userId}
  `;
  const row = rows[0];
  const provider =
    typeof row?.default_provider === "string" &&
    PROVIDER_IDS.includes(row.default_provider as ProviderId)
      ? (row.default_provider as ProviderId)
      : null;
  const model =
    typeof row?.default_model === "string" && row.default_model.trim()
      ? row.default_model.trim()
      : null;
  const visual =
    typeof row?.visual_confirmation === "string" &&
    isVisualConfirmationId(row.visual_confirmation)
      ? row.visual_confirmation
      : DEFAULT_VISUAL_CONFIRMATION;
  return { provider, model, visualConfirmation: visual };
}

/**
 * Persists deploy defaults. Omitted fields are left unchanged; `null` clears
 * provider/model back to auto.
 * @param userId - Signed-in user id.
 * @param patch - Fields to update.
 * @returns The full defaults after the write.
 */
export async function setDeployDefaults(
  userId: string,
  patch: {
    provider?: ProviderId | null;
    model?: string | null;
    visualConfirmation?: VisualConfirmationId;
  },
): Promise<DeployDefaults> {
  const hasCols = await ensureDeployDefaultColumns();
  const current = await getDeployDefaults(userId);
  const next: DeployDefaults = {
    provider: patch.provider !== undefined ? patch.provider : current.provider,
    model: patch.model !== undefined ? patch.model : current.model,
    visualConfirmation:
      patch.visualConfirmation !== undefined
        ? patch.visualConfirmation
        : current.visualConfirmation,
  };
  // Provider switch invalidates a model id from another catalog.
  if (
    patch.provider !== undefined &&
    patch.provider !== current.provider &&
    patch.model === undefined
  ) {
    next.model = null;
  }

  if (!hasCols) {
    // Old schema: only visual_confirmation is writable until migration runs.
    await sql`
      insert into user_settings (user_id, visual_confirmation)
      values (${userId}, ${next.visualConfirmation})
      on conflict (user_id) do update
        set visual_confirmation = excluded.visual_confirmation
    `;
    return { ...next, provider: null, model: null };
  }

  await sql`
    insert into user_settings (
      user_id, default_provider, default_model, visual_confirmation
    )
    values (
      ${userId}, ${next.provider}, ${next.model}, ${next.visualConfirmation}
    )
    on conflict (user_id) do update set
      default_provider = excluded.default_provider,
      default_model = excluded.default_model,
      visual_confirmation = excluded.visual_confirmation
  `;
  return next;
}
