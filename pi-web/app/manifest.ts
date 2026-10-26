import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  const appName = process.env.PI_WEB_APP_NAME?.trim() || "MINO AGENT";
  return {
    id: "/",
    name: appName,
    short_name: appName,
    description: "你的求职搭档：简历、岗位匹配与面试准备", 
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a1a1a",
    categories: ["education", "productivity"],
    lang: "zh-CN",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
