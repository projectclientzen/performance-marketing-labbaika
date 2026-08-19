import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Labbaika Reporting",
  description: "Platform pelaporan performa Labbaika Group",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
