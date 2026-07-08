import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import { getSession } from "@/lib/auth";
import { getUserClaudeStatus } from "@/lib/anthropic";
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
  const claudeStatus = user ? await getUserClaudeStatus(user) : "none";
  const navUser = user ? { id: user.id, name: user.name, email: user.email, claudeStatus } : null;

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Providers>
          <Nav user={navUser} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
