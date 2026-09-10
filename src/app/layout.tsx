import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRefresh from "@/components/ServiceWorkerRefresh";

export const metadata: Metadata = {
  title: "골프비서",
  description: "스코어카드 스캔과 라운드 기록을 한곳에서 — 로컬 전용 골프 스코어 도우미",
  applicationName: "골프비서",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "골프비서",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2c6937",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="bg-golf-50 text-golf-950 antialiased">
        <ServiceWorkerRefresh />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
