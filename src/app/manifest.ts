import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZELVOA",
    short_name: "ZELVOA",
    description: "Social media management in one place.",
    start_url: "/app/dashboard",
    display: "standalone",
    background_color: "#0b0e14",
    theme_color: "#6d28d9",
    icons: [
      { src: "/favicon.ico", sizes: "16x16 32x32", type: "image/x-icon" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
