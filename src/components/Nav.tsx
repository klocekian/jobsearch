"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { Button } from "@astryxdesign/core/Button";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { HStack } from "@astryxdesign/core/HStack";

type ClaudeStatus = "connected" | "expired" | "none";
interface NavUser { id: number; name: string; email: string; claudeStatus: ClaudeStatus }

const CLAUDE_STATUS_DOT: Record<ClaudeStatus, { variant: "success" | "warning" | "neutral"; label: string }> = {
  connected: { variant: "success", label: "Claude connected" },
  expired: { variant: "warning", label: "Claude token expired — reconnect in Profile" },
  none: { variant: "neutral", label: "Claude not connected" },
};

export function Nav({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus>(user?.claudeStatus ?? "none");

  useEffect(() => {
    if (!user) return;
    const checkStatus = () => {
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d: { user?: { claudeStatus?: ClaudeStatus } | null }) => {
          if (d.user?.claudeStatus) setClaudeStatus(d.user.claudeStatus);
        })
        .catch(() => {});
    };

    // Listen for explicit auth status changes (e.g. after connecting Claude)
    window.addEventListener("auth-change", checkStatus);
    return () => window.removeEventListener("auth-change", checkStatus);
  }, [user]);

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-border">
      <TopNav
        label="Main navigation"
        heading={<TopNavHeading heading="Job Search" headingHref="/jobs" />}
        endContent={
          user ? (
            <TopNavItem
              label={user.name || user.email || "Profile"}
              href="/profile"
              isSelected={pathname.startsWith("/profile")}
              icon={<StatusDot {...CLAUDE_STATUS_DOT[claudeStatus]} tooltip={CLAUDE_STATUS_DOT[claudeStatus].label} />}
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
