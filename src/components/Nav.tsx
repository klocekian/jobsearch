"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { HStack } from "@astryxdesign/core/HStack";
import { STATUS_OPTIONS } from "@/lib/status";
import { JobStatusDot } from "./icons";

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

interface JobWorkspaceState {
  jobId: number;
  status: string;
  analyzing: boolean;
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

  const isAdding = pathname === "/jobs" && searchParams.get("add") === "1";
  const isJobPage = pathname.startsWith("/jobs/") && pathname !== "/jobs";
  const isSubPage = pathname.startsWith("/profile") || isJobPage || isAdding || (pathname !== "/" && pathname !== "/jobs");
  const headingText = isSubPage ? "← All jobs" : "Job Search";

  const [actionState, setActionState] = useState<{ importing: boolean; checking: boolean }>({ importing: false, checking: false });
  const [jobWorkspaceState, setJobWorkspaceState] = useState<JobWorkspaceState | null>(null);
  const [withAi, setWithAi] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("jobWorkspaceWithAi") === "1";
    }
    return false;
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ importing?: boolean; checking?: boolean }>;
      if (custom.detail) {
        setActionState((prev) => ({ ...prev, ...custom.detail }));
      }
    };
    window.addEventListener("jobs-action-status", handler);
    return () => window.removeEventListener("jobs-action-status", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<JobWorkspaceState>;
      if (custom.detail) {
        setJobWorkspaceState(custom.detail);
      }
    };
    window.addEventListener("job-workspace-sync", handler);
    return () => window.removeEventListener("job-workspace-sync", handler);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-border">
      <TopNav
        label="Main navigation"
        heading={<TopNavHeading heading={headingText} headingHref="/jobs" />}
        endContent={
          user ? (
            <HStack gap={3} className="items-center">
              {!isSubPage && (
                <HStack gap={2} className="items-center mr-2">
                  <Button
                    label={actionState.checking ? "Checking…" : "Check closed"}
                    variant="ghost"
                    size="sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("jobs-action-check-closed"))}
                    isDisabled={actionState.checking}
                  />
                  <Button
                    label={actionState.importing ? "Importing…" : "Import from Google Sheet"}
                    variant="ghost"
                    size="sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("jobs-action-import"))}
                    isDisabled={actionState.importing}
                  />
                  <Button label="Add Job" variant="primary" size="sm" href="/jobs?add=1" />
                </HStack>
              )}

              {isJobPage && (
                <HStack gap={2} className="items-center mr-2">
                  <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={withAi}
                      onChange={(e) => {
                        setWithAi(e.target.checked);
                        localStorage.setItem("jobWorkspaceWithAi", e.target.checked ? "1" : "0");
                      }}
                      className="accent-primary rounded cursor-pointer"
                    />
                    <span>with AI</span>
                  </label>
                  <Button
                    label={jobWorkspaceState?.analyzing ? "Analyzing…" : "Analyze"}
                    variant="primary"
                    size="sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("job-workspace-action", { detail: { action: "analyze", withAi } }))}
                    isDisabled={jobWorkspaceState?.analyzing}
                  />
                  {jobWorkspaceState?.status && (
                    <Selector
                      label="Status"
                      isLabelHidden
                      size="sm"
                      className="w-36"
                      startIcon={<JobStatusDot status={jobWorkspaceState.status} />}
                      options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, icon: <JobStatusDot status={s.value} /> }))}
                      value={jobWorkspaceState.status}
                      onChange={(v) => window.dispatchEvent(new CustomEvent("job-workspace-action", { detail: { action: "status", status: v } }))}
                    />
                  )}
                  <DropdownMenu
                    button={{ label: "⋯", variant: "ghost", size: "sm" }}
                    items={[
                      {
                        label: "Delete Job",
                        onClick: () => window.dispatchEvent(new CustomEvent("job-workspace-action", { detail: { action: "delete" } })),
                      },
                    ]}
                  />
                </HStack>
              )}

              <TopNavItem
                label={user.name || user.email || "Profile"}
                href="/profile"
                isSelected={pathname.startsWith("/profile")}
                icon={<StatusDot variant={dotVariant} label={providerLabel} tooltip={providerLabel} />}
              />
            </HStack>
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
