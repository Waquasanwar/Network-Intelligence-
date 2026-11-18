import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/brand";

/** Makes the platform installable: on a phone it goes on the home screen and opens full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Amana",
    description: "Your private network of expertise, known first hand.",
    id: "/",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#eef0f5",
    theme_color: "#0c1b33",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ask your network", url: "/overview", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Requirements", url: "/requirements", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
