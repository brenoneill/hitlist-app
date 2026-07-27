import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dev-only: Next blocks cross-origin /_next/* requests, so the phone gets HTML
  // with no JS — stuck on "Scanning…", nothing clickable. Widen if the LAN changes.
  allowedDevOrigins: ["192.168.178.*"],
};

export default nextConfig;
