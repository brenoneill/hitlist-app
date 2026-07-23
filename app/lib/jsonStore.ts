import { promises as fs } from "node:fs";
import path from "node:path";

// ponytail: JSON file store — fine for single-user local dev. Swap for SQLite/Postgres
// before deploying to serverless (ephemeral/read-only fs). Read-modify-write also races
// under concurrent writes; single user so it doesn't matter yet.
export function jsonFile<T>(name: string, empty: () => T) {
  const file = path.join(process.cwd(), ".data", name);
  return {
    async read(): Promise<T> {
      try {
        return JSON.parse(await fs.readFile(file, "utf8")) as T;
      } catch {
        return empty();
      }
    },
    async write(value: T): Promise<void> {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(value, null, 2));
    },
  };
}
