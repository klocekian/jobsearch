"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { HStack } from "@astryxdesign/core/HStack";
import { STATUS_OPTIONS } from "@/lib/status";
import { apiGet } from "@/lib/api-client";
import type { ClaudeStatus } from "@/lib/anthropic";
import type { UserAIStatus } from "@/lib/ai";
import { ChevronUpIcon, ChevronDownIcon, JobStatusDot } from "./icons";

interface NavUser {
  id: number;
  name: string;
  email: string;
  claudeStatus?: ClaudeStatus;
  aiStatus?: UserAIStatus;
}

interface JobWorkspaceState {
  jobId: number;
  status: string;
  analyzing: boolean;
}

export function Nav({ user }: { user: NavUser | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [aiStatus, setAiStatus] = useState<UserAIStatus | null>(user?.aiStatus ?? null);

  useEffect(() => {
    if (!user) return;
    const checkStatus = () => {
      apiGet<{ user?: { aiStatus?: UserAIStatus } | null }>("/api/auth/me")
        .then((d) => {
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
  const headingText = isSubPage ? "← All jobs" : user ? "Job Search" : "Job Search by Fieldlines";

  const [jobListIds, setJobListIds] = useState<number[]>([]);

  useEffect(() => {
    if (!isJobPage) return;

    const loadIds = async () => {
      try {
        const stored = sessionStorage.getItem("jobListIds");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setJobListIds(parsed);
            return;
          }
        }
      } catch {}

      try {
        const sortKey = (typeof window !== "undefined" && sessionStorage.getItem("jobsSortKey")) || "created_at";
        const sortOrder = (typeof window !== "undefined" && sessionStorage.getItem("jobsSortOrder")) || "desc";
        const statusFilter = (typeof window !== "undefined" && sessionStorage.getItem("jobsStatusFilter")) || "";
        const params = new URLSearchParams();
        params.set("sort", sortKey);
        params.set("order", sortOrder);
        if (statusFilter) params.set("status", statusFilter);

        const data = await apiGet<{ jobs?: { id: number }[] }>(`/api/jobs?${params.toString()}`);
        const ids = (data.jobs || []).map((j) => j.id);
        setJobListIds(ids);
        try {
          sessionStorage.setItem("jobListIds", JSON.stringify(ids));
        } catch {}
      } catch {}
    };

    loadIds();
  }, [isJobPage, pathname]);

  const currentJobId = isJobPage ? parseInt(pathname.replace("/jobs/", "").split("/")[0], 10) : null;
  const currentIndex = currentJobId !== null ? jobListIds.indexOf(currentJobId) : -1;
  const prevJobId = currentIndex > 0 ? jobListIds[currentIndex - 1] : null;
  const nextJobId = currentIndex >= 0 && currentIndex < jobListIds.length - 1 ? jobListIds[currentIndex + 1] : null;
  const totalJobs = jobListIds.length;

  useEffect(() => {
    if (!isJobPage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (e.key === "k" || (e.key === "ArrowUp" && e.altKey)) {
        if (prevJobId) {
          e.preventDefault();
          router.push(`/jobs/${prevJobId}`);
        }
      } else if (e.key === "j" || (e.key === "ArrowDown" && e.altKey)) {
        if (nextJobId) {
          e.preventDefault();
          router.push(`/jobs/${nextJobId}`);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isJobPage, prevJobId, nextJobId, router]);

  const [actionState, setActionState] = useState<{ importing: boolean; checking: boolean }>({ importing: false, checking: false });
  const [jobWorkspaceState, setJobWorkspaceState] = useState<JobWorkspaceState | null>(null);

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

  const userItem = user ? (
    <TopNavItem
      label={user.name || user.email || "Profile"}
      href="/profile"
      isSelected={pathname.startsWith("/profile")}
      icon={<StatusDot variant={dotVariant} label={providerLabel} tooltip={providerLabel} />}
    />
  ) : null;

  const jobStepper = (
    <HStack gap={1} className="items-center">
      <Button
        label="Previous job"
        isIconOnly
        icon={<ChevronUpIcon className="h-4 w-4" />}
        variant="ghost"
        size="sm"
        onClick={() => prevJobId && router.push(`/jobs/${prevJobId}`)}
        isDisabled={!prevJobId}
        tooltip="Previous job (k)"
      />
      <Button
        label="Next job"
        isIconOnly
        icon={<ChevronDownIcon className="h-4 w-4" />}
        variant="ghost"
        size="sm"
        onClick={() => nextJobId && router.push(`/jobs/${nextJobId}`)}
        isDisabled={!nextJobId}
        tooltip="Next job (j)"
      />
      {currentIndex >= 0 && (
        <span className="text-sm text-secondary ml-1 select-none whitespace-nowrap">
          {currentIndex + 1} of {totalJobs}
        </span>
      )}
    </HStack>
  );

  const jobControls = jobWorkspaceState?.status ? (
    <HStack gap={1.5} className="items-center">
      <span className="text-sm text-secondary whitespace-nowrap">Change Status:</span>
      <Selector
        label="Change Status"
        isLabelHidden
        size="sm"
        className="w-36"
        startIcon={<JobStatusDot status={jobWorkspaceState.status} />}
        options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, icon: <JobStatusDot status={s.value} /> }))}
        value={jobWorkspaceState.status}
        onChange={(v) => window.dispatchEvent(new CustomEvent("job-workspace-action", { detail: { action: "status", status: v } }))}
      />
    </HStack>
  ) : null;

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-border">
      {isJobPage && user && (
        // Right-aligned to the job workspace's left column (--job-split, set
        // by the workspace); the analysis card covers the nav to its right.
        <div
          className="absolute inset-y-0 z-10 flex items-center gap-3"
          style={{ right: "calc(100% - var(--job-split, 100%) + 16px)" }}
        >
          {jobControls}
        </div>
      )}
      <TopNav
        label="Main navigation"
        heading={<TopNavHeading heading={headingText} headingHref="/jobs" />}
        startContent={isJobPage && totalJobs > 0 ? jobStepper : undefined}
        endContent={
          // On a job page everything sits on the left, leaving the right
          // for the workspace's analysis card to rise into.
          isJobPage && user ? undefined : user ? (
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

              {userItem}
            </HStack>
          ) : (
            <HStack gap={3} className="items-center">
              <a href="#capture" className="text-sm text-secondary hover:text-primary hidden lg:inline-block transition-colors">
                Save jobs
              </a>
              <a href="#fitness" className="text-sm text-secondary hover:text-primary hidden lg:inline-block transition-colors">
                Understand your fit
              </a>
              <a href="#ats-engine" className="text-sm text-secondary hover:text-primary hidden lg:inline-block transition-colors">
                Resume checks
              </a>
              <a href="#rewriter" className="text-sm text-secondary hover:text-primary hidden lg:inline-block transition-colors">
                Tailor your resume
              </a>
              <a href="#ai" className="text-sm text-secondary hover:text-primary hidden lg:inline-block transition-colors">
                Use with Claude
              </a>
              {process.env.NODE_ENV === "development" && (
                <a href="/api/auth/dev-login">
                  <Button label="Sign in as demo user" variant="secondary" size="sm" />
                </a>
              )}
              <a href="/api/auth/login">
                <Button label="Sign in with Google" variant="primary" size="sm" />
              </a>
            </HStack>
          )
        }
      />
    </header>
  );
}
