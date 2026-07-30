import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dev-only: Next blocks cross-origin /_next/* requests, so the phone gets HTML
  // with no JS — stuck on "Scanning…", nothing clickable. Widen if the LAN changes.
  allowedDevOrigins: ["192.168.178.*"],
  // PGlite (E2E in-memory DB) ships wasm assets the bundler can't inline
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
