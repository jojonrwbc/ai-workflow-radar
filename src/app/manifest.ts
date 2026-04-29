import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hook AI",
    short_name: "Hook AI",
    description: "Wir fischen die Signale aus dem KI-Rauschen. Daily Feed für Builder.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#f6f5f2",
    icons: [
      {
        src: "/icon",
        type: "image/png",
        sizes: "512x512",
      },
      {
        src: "/apple-icon",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  };
}
