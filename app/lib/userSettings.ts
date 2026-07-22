import { promises as fs } from "node:fs";
import path from "node:path";

interface UserSettings {
  cursorApiKey?: string;
  githubInstallationId?: string;
}

// ponytail: JSON file store, same tradeoffs as tasks.ts — plaintext keys on
// local disk, fine until this deploys somewhere with real users. Swap for an
// encrypted column in a real datastore before then.
const FILE = path.join(process.cwd(), ".data", "users.json");

async function readAll(): Promise<Record<string, UserSettings>> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}

async function writeAll(all: Record<string, UserSettings>): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

export async function getCursorApiKey(
  userId: string,
): Promise<string | undefined> {
  return (await readAll())[userId]?.cursorApiKey;
}

export async function setCursorApiKey(
  userId: string,
  cursorApiKey: string,
): Promise<void> {
  const all = await readAll();
  all[userId] = { ...all[userId], cursorApiKey };
  await writeAll(all);
}

export async function getGithubInstallationId(
  userId: string,
): Promise<string | undefined> {
  return (await readAll())[userId]?.githubInstallationId;
}

export async function setGithubInstallationId(
  userId: string,
  githubInstallationId: string,
): Promise<void> {
  const all = await readAll();
  all[userId] = { ...all[userId], githubInstallationId };
  await writeAll(all);
}
