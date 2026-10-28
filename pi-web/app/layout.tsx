import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { PwaRegistration } from "@/components/PwaRegistration";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./settings.css";
import "./sidebar.css";
import "./sidebar-menu.css";

const notoSansMono = localFont({
  src: './fonts/NotoSansMono.ttf',
  weight: '100 900',
  variable: "--font-noto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MINOS",
  description: "MINOS 求职助手：简历优化、岗位匹配、面试准备与求职规划",
  applicationName: "MINOS",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/icons/minos-logo-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/minos-logo-apple.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MINOS",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" translate="no" className={`${notoSansMono.variable} notranslate`} suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
      </head>
      <body translate="no" className="notranslate" suppressHydrationWarning>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
