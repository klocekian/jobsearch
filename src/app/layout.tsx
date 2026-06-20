import type { Metadata } from "next";
// Self-hosted Geist fonts (bundled .woff2 files) — no Google Fonts fetch at
// build time. GeistSans/GeistMono already expose --font-geist-sans/-mono.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Match Report — Resume Match Engine",
  description:
    "Analyze how well a resume positions a candidate for a specific role against ATS criteria.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
