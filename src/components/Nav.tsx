"use client";

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
            <StatusDot {...CLAUDE_STATUS_DOT[user.claudeStatus]} tooltip={CLAUDE_STATUS_DOT[user.claudeStatus].label} />
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
