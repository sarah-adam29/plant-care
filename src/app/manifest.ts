/**
 * manifest.ts — lets phones "Add to Home Screen" as an app.
 *
 * 📘 LEARN: Next.js turns this into /manifest.webmanifest. With it (plus the
 * icon.png / apple-icon.png files next to it), the site opens full-screen
 * from your home screen, with its own icon and no browser bars.
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plant Care",
    short_name: "Plants",
    description: "Remembers what's happening with every plant and tells you what to check next.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
