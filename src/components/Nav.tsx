"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiGet } from "@/lib/api-client";
import type { ClaudeStatus } from "@/lib/anthropic";
import type { UserAIStatus } from "@/lib/ai";
import { SearchNav } from "./search/SearchNav";
import { BrandMark } from "./BrandMark";

interface NavUser {
  id: number;
  name: string;
  email: string;
  claudeStatus?: ClaudeStatus;
  aiStatus?: UserAIStatus;
}

const APP_PATHS = ["/jobs", "/profile"];

/** Signed in, the app pages get the workspace sidebar; everything else gets the public header. */
export function Nav({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const aiStatus = useAiStatus(user);
  if (user && APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return <SearchNav name={user.name || user.email} aiStatus={aiStatus} />;
  }
  return <PublicNav signedIn={!!user} isLanding={pathname === "/" || pathname === "/login"} />;
}

export interface AiConnection {
  connected: boolean;
  label: string;
}

/** The AI provider connection, refreshed when sign-in or provider settings change. */
function useAiStatus(user: NavUser | null): AiConnection {
  const [status, setStatus] = useState<UserAIStatus | null>(user?.aiStatus ?? null);
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      apiGet<{ user?: { aiStatus?: UserAIStatus } | null }>("/api/auth/me")
        .then((d) => { if (d.user?.aiStatus) setStatus(d.user.aiStatus); })
        .catch(() => {});
    };
    window.addEventListener("auth-change", refresh);
    return () => window.removeEventListener("auth-change", refresh);
  }, [user]);
  const connected = status?.connected ?? user?.claudeStatus === "connected";
  const label = status?.providerName ? `${status.providerName} connected` : connected ? "AI connected" : "AI not connected";
  return { connected, label };
}

const SECTIONS = [
  ["#capture", "Save jobs"],
  ["#fitness", "Understand your fit"],
  ["#ats-engine", "Resume checks"],
  ["#rewriter", "Tailor your resume"],
  ["#ai", "Use with Claude"],
];

function PublicNav({ signedIn, isLanding }: { signedIn: boolean; isLanding: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-primary">
          <BrandMark size={24} />
          fieldlines <span className="font-normal text-secondary">Job Search</span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-1">
          {isLanding && SECTIONS.map(([href, label]) => (
            <a key={href} href={href} className="hidden rounded-md px-2.5 py-1.5 text-sm text-secondary transition-colors hover:bg-muted hover:text-primary lg:inline-block">
              {label}
            </a>
          ))}
          <span className="ml-3 flex items-center gap-2">
            {signedIn ? (
              <Button label="Open Job Search" variant="primary" size="sm" href="/jobs" />
            ) : (
              <>
                {process.env.NODE_ENV === "development" && (
                  <Button label="Sign in as demo user" variant="secondary" size="sm" href="/api/auth/dev-login" />
                )}
                <Button label="Sign in with Google" variant="primary" size="sm" href="/api/auth/login" />
              </>
            )}
          </span>
        </nav>
      </div>
    </header>
  );
}
