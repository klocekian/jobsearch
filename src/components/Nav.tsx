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
  // `user` comes from the root layout, a Server Component that only runs once
  // per hard load — it never re-executes on client-side navigation, so its
  // claudeStatus goes stale the moment the token state changes mid-session
  // (e.g. after reconnecting on the Profile page). Re-fetch on every
  // navigation so the dot always reflects the current state.
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus>(user?.claudeStatus ?? "none");

  useEffect(() => {
    if (!user) return;
    fetch("/api/auth/me").then((r) => r.json())
      .then((d: { user?: { claudeStatus?: ClaudeStatus } | null }) => {
        if (d.user?.claudeStatus) setClaudeStatus(d.user.claudeStatus);
      })
      .catch(() => {});
  }, [pathname, user]);

  return (
    <TopNav
      label="Main navigation"
      heading={<TopNavHeading heading="Job Search" headingHref="/jobs" />}
      startContent={
        <>
          <TopNavItem label="Jobs" href="/jobs" isSelected={pathname.startsWith("/jobs")} />
          <TopNavItem label="Profile" href="/profile" isSelected={pathname.startsWith("/profile")} />
        </>
      }
      endContent={
        user ? (
          <HStack gap={2} className="items-center">
            <StatusDot {...CLAUDE_STATUS_DOT[claudeStatus]} tooltip={CLAUDE_STATUS_DOT[claudeStatus].label} />
            <span>{user.name || user.email}</span>
          </HStack>
        ) : (
          <a href="/api/auth/login">
            <Button label="Sign in with Google" variant="ghost" size="sm" />
          </a>
        )
      }
    />
  );
}
