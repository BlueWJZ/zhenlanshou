import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./brand-theme.css";
import "./features.css";
import "./legal.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "真藍瘦｜飲食與運動紀錄",
  description: "記錄外食、運動與體重，用清楚的數據建立適合自己的生活節奏。",
  applicationName: "真藍瘦",
  category: "health",
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "真藍瘦",
  },
  manifest: "/manifest.webmanifest",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/app-icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3979b8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <head>
        {/* Vinext 目前未輸出 Viewport.viewportFit，需保留這個 PWA 安全區設定。 */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
