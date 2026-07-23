import { promises as fs } from "node:fs";
import path from "node:path";

export type TaskStatus = "inbox" | "running" | "done" | "failed";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  note?: string;
  cursorAgentId?: string;
  agentUrl?: string;
  repoUrl?: string;
}

// ponytail: JSON file store — fine for single-user local dev. Swap for SQLite/Postgres
// before deploying to serverless (ephemeral/read-only fs). Read-modify-write also races
// under concurrent writes; single user so it doesn't matter yet.
const FILE = path.join(process.cwd(), ".data", "tasks.json");

async function readAll(): Promise<Task[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Task[];
  } catch {
    return [];
  }
}

async function writeAll(tasks: Task[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(tasks, null, 2));
}

export async function listTasks(): Promise<Task[]> {
  return readAll();
}

export async function addTask(title: string, repoUrl: string): Promise<Task> {
  const tasks = await readAll();
  const task: Task = {
    id: crypto.randomUUID(),
    title,
    status: "inbox",
    createdAt: new Date().toISOString(),
    repoUrl,
  };
  tasks.unshift(task);
  await writeAll(tasks);
  return task;
}

export async function removeTask(id: string): Promise<void> {
  const tasks = await readAll();
  await writeAll(tasks.filter((t) => t.id !== id));
}

export async function getTask(id: string): Promise<Task | undefined> {
  return (await readAll()).find((t) => t.id === id);
}

export async function updateTask(
  id: string,
  patch: Partial<Task>,
): Promise<Task | undefined> {
  const tasks = await readAll();
  const i = tasks.findIndex((t) => t.id === id);
  if (i === -1) return undefined;
  tasks[i] = { ...tasks[i], ...patch };
  await writeAll(tasks);
  return tasks[i];
}
