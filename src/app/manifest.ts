import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Content Team Booking",
    short_name: "Content Team",
    description:
      "Book content creators, log deliverables, and track KPIs",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f9fa",
    theme_color: "#5463be",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
