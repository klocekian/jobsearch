"use client";

import { usePathname } from "next/navigation";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { Button } from "@astryxdesign/core/Button";

interface NavUser { id: number; name: string; email: string }

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
          <span>{user.name || user.email}</span>
        ) : (
          <a href="/api/auth/login">
            <Button label="Sign in with Google" variant="ghost" size="sm" />
          </a>
        )
      }
    />
  );
}
