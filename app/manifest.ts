import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HitList",
    short_name: "HitList",
    description:
      "Make dev work from your phone scale. Gather phone-sized tasks, dispatch Cursor cloud agents, and review PRs with visual proof. Free and open source — bring your own key.",
    start_url: "/app",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
