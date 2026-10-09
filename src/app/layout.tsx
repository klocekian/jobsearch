import { Suspense } from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
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
    <html
      lang="en"
      data-astryx-theme="neutral"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body data-astryx-theme="neutral" className="min-h-full flex flex-col bg-surface text-primary">
        <Providers>
          <Suspense fallback={null}>
            <Nav user={navUser} />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
