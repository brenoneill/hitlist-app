import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // DAL imports `server-only`; tests are not an RSC graph.
      "server-only": path.resolve(root, "tests/shims/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PGlite + AES key for DAL/integration; must be set before app/lib/db|crypto load.
    env: {
      AUTH_E2E: "1",
      SETTINGS_ENCRYPTION_KEY:
        "ZTJlLWZpeGVkLWtleS0zMi1ieXRlcy1hYWFhYWFhYWE=",
    },
  },
});
