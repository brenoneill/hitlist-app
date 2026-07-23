import { jsonFile } from "./jsonStore";

interface UserSettings {
  cursorApiKey?: string;
  githubInstallationId?: string;
}

// ponytail: plaintext keys on local disk, fine until this deploys somewhere with
// real users. Swap for an encrypted column in a real datastore before then.
const store = jsonFile<Record<string, UserSettings>>("users.json", () => ({}));

export async function getCursorApiKey(
  userId: string,
): Promise<string | undefined> {
  return (await store.read())[userId]?.cursorApiKey;
}

export async function setCursorApiKey(
  userId: string,
  cursorApiKey: string,
): Promise<void> {
  const all = await store.read();
  all[userId] = { ...all[userId], cursorApiKey };
  await store.write(all);
}

export async function getGithubInstallationId(
  userId: string,
): Promise<string | undefined> {
  return (await store.read())[userId]?.githubInstallationId;
}

export async function setGithubInstallationId(
  userId: string,
  githubInstallationId: string,
): Promise<void> {
  const all = await store.read();
  all[userId] = { ...all[userId], githubInstallationId };
  await store.write(all);
}
