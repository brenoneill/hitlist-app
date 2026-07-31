import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// ponytail: git log read at build time, so the footer date updates itself on every deploy
const lastUpdated = (() => {
  try {
    return execSync("git log -1 --format=%cI").toString().trim();
  } catch {
    return new Date().toISOString();
  }
})();

const nextConfig: NextConfig = {
  // dev-only: Next blocks cross-origin /_next/* requests, so the phone gets HTML
  // with no JS — stuck on "Scanning…", nothing clickable. Widen if the LAN changes.
  allowedDevOrigins: ["192.168.178.*"],
  // PGlite (E2E in-memory DB) ships wasm assets the bundler can't inline
  serverExternalPackages: ["@electric-sql/pglite"],
  env: {
    NEXT_PUBLIC_LAST_UPDATED: lastUpdated,
  },
};

export default nextConfig;
