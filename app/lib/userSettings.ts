import { sql } from "./db";
import { decrypt, encrypt } from "./crypto";
import type { ProviderId } from "./providerMeta";

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
