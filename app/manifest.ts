import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "法语词卡",
    short_name: "法语词卡",
    description: "每天一课，记住 A1-A2 法语词汇",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7f3ea",
    theme_color: "#f7f3ea",
    lang: "zh-CN",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
