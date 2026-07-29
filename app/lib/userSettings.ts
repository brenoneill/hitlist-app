import { sql } from "./db";
import { decrypt, encrypt } from "./crypto";

export async function getCursorApiKey(
  userId: string,
): Promise<string | undefined> {
  const rows = await sql`
    select cursor_api_key from user_settings where user_id = ${userId}
  `;
  const encrypted = rows[0]?.cursor_api_key;
  return encrypted ? decrypt(encrypted) : undefined;
}

export async function setCursorApiKey(
  userId: string,
  cursorApiKey: string,
): Promise<void> {
  await sql`
    insert into user_settings (user_id, cursor_api_key)
    values (${userId}, ${encrypt(cursorApiKey)})
    on conflict (user_id) do update set cursor_api_key = excluded.cursor_api_key
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
