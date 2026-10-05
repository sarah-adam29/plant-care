import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the project root to this folder (a stray package-lock.json higher up
  // on the Mac was confusing Next.js about where the project starts).
  turbopack: { root: path.join(__dirname) },
  // Let phones on your home Wi-Fi (192.168.x.x) use the dev server, not just this Mac.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  experimental: {
    // Photos are resized in the browser to ~1280px before upload (~200–400 KB),
    // and up to 4 photos can be sent at once for identification.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
