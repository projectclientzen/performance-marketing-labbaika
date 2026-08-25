import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Labbaika Reporting",
  description: "Platform pelaporan performa Labbaika Group",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0b3d54",
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover mengaktifkan env(safe-area-inset-*) di iOS — dipakai
  // bottom-nav CS supaya lolos home-indicator. Tanpa ini, safe-area mati.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Labbaika" />
      </head>
      <body>{children}</body>
    </html>
  );
}
