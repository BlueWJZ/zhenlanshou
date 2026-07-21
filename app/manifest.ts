import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "真藍瘦｜飲食與運動紀錄",
    short_name: "真藍瘦",
    description: "記錄外食、運動、飲水與體重，掌握每天的生活節奏。",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8f9",
    theme_color: "#3979b8",
    lang: "zh-Hant",
    icons: [
      {
        src: "/icons/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
