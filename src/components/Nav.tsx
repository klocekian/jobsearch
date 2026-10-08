"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { Button } from "@astryxdesign/core/Button";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { HStack } from "@astryxdesign/core/HStack";

interface NavAIStatus {
  connected: boolean;
  activeProvider: string | null;
  providerName: string | null;
  configuredCount: number;
}

interface NavUser {
  id: number;
  name: string;
  email: string;
  claudeStatus?: "connected" | "expired" | "none";
  aiStatus?: NavAIStatus;
}

export function Nav({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [aiStatus, setAiStatus] = useState<NavAIStatus | null>(user?.aiStatus ?? null);

  useEffect(() => {
    if (!user) return;
    const checkStatus = () => {
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d: { user?: { aiStatus?: NavAIStatus } | null }) => {
          if (d.user?.aiStatus) setAiStatus(d.user.aiStatus);
        })
        .catch(() => {});
    };

    window.addEventListener("auth-change", checkStatus);
    return () => window.removeEventListener("auth-change", checkStatus);
  }, [user]);

  const isConnected = aiStatus?.connected ?? (user?.claudeStatus === "connected");
  const providerLabel = aiStatus?.providerName ? `${aiStatus.providerName} connected` : isConnected ? "AI connected" : "AI not connected";
  const dotVariant = isConnected ? "success" : "neutral";

  const isSubPage = pathname.startsWith("/profile") || pathname.startsWith("/jobs/") || (pathname === "/jobs" && searchParams.get("add") === "1");
  const headingText = isSubPage ? "← All jobs" : "Job Search";

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-border">
      <TopNav
        label="Main navigation"
        heading={<TopNavHeading heading={headingText} headingHref="/jobs" />}
        endContent={
          user ? (
            <TopNavItem
              label={user.name || user.email || "Profile"}
              href="/profile"
              isSelected={pathname.startsWith("/profile")}
              icon={<StatusDot variant={dotVariant} label={providerLabel} tooltip={providerLabel} />}
            />
          ) : (
            <HStack gap={2} className="items-center">
              <TopNavItem label="Profile" href="/profile" isSelected={pathname.startsWith("/profile")} />
              <a href="/api/auth/login">
                <Button label="Sign in with Google" variant="ghost" size="sm" />
              </a>
            </HStack>
          )
        }
      />
    </header>
  );
}
