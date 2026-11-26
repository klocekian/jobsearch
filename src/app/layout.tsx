import { Suspense } from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Nav } from "@/components/Nav";
import { ThemeSync } from "@/components/theme";
import { THEME_SCRIPT } from "@/lib/theme-script";
import { getSession } from "@/lib/auth";
import { getUserClaudeStatus } from "@/lib/anthropic";
import { getUserAIStatus } from "@/lib/ai";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Search — Resume Match Engine",
  description:
    "Track job applications, analyze resume match, generate tailored materials.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSession().catch(() => null);
  const [claudeStatus, aiStatus] = await Promise.all([
    user ? getUserClaudeStatus(user) : Promise.resolve("none" as const),
    user ? getUserAIStatus(user.id) : Promise.resolve(null),
  ]);
  const navUser = user
    ? { id: user.id, name: user.name, email: user.email, claudeStatus, aiStatus: aiStatus ?? undefined }
    : null;

  return (
    // The theme script sets data-theme before React hydrates.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-body text-primary">
        <ThemeSync />
        <Suspense fallback={null}>
          <Nav user={navUser} />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
