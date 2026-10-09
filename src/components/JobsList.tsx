"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import { STATUS_OPTIONS } from "@/lib/status";
import { BAND_VARIANTS, bandForScore } from "@/lib/fitness/schema";
import { formatDate } from "@/lib/format";
import { JobStatusDot } from "./icons";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Stack, HStack } from "@astryxdesign/core/Stack";
import { Banner } from "@astryxdesign/core/Banner";
import { Table, useTableSortable, proportional, pixel } from "@astryxdesign/core/Table";
import type { TableColumn, TableSortState } from "@astryxdesign/core/Table";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { ImportSheetModal } from "./ImportSheetModal";
import { OnboardingWizardModal } from "./OnboardingWizardModal";

type SortKey = "company" | "title" | "status" | "salary_max" | "location" | "match_score" | "fitness_score" | "created_at" | "applied_at";

function formatSalary(job: JobRow): string {
  if (job.salary_text) return job.salary_text;
  if (job.salary_min && job.salary_max) return `$${(job.salary_min / 1000).toFixed(0)}k–$${(job.salary_max / 1000).toFixed(0)}k`;
  if (job.salary_min) return `$${(job.salary_min / 1000).toFixed(0)}k+`;
  if (job.salary_max) return `Up to $${(job.salary_max / 1000).toFixed(0)}k`;
  return "";
}

export function JobsList({ jobsPromise }: { jobsPromise: Promise<JobRow[]> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  // fetchJobs (the client-side sort/filter-aware fetch below) is the
  // authoritative source once it resolves. jobsPromise — already in flight
  // from the server before this component even mounted — is purely a faster
  // first paint for the default view; if fetchJobs somehow wins the race,
  // don't let the slower default-sorted promise clobber its result.
  const fetchedFromClient = useRef(false);
  useEffect(() => {
    jobsPromise.then((initial) => {
      if (fetchedFromClient.current) return;
      setJobs(initial);
      setLoading(false);
      try {
        sessionStorage.setItem("jobListIds", JSON.stringify(initial.map((j) => j.id)));
      } catch {}
    });
  }, [jobsPromise]);

  useEffect(() => {
    if (jobs.length > 0) {
      try {
        sessionStorage.setItem("jobListIds", JSON.stringify(jobs.map((j) => j.id)));
      } catch {}
    }
  }, [jobs]);
  const [sortKey, setSortKey] = useState<SortKey>(() =>
    (typeof window !== "undefined" && sessionStorage.getItem("jobsSortKey") as SortKey) || "created_at"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() =>
    (typeof window !== "undefined" && sessionStorage.getItem("jobsSortOrder") as "asc" | "desc") || "desc"
  );
  const [statusFilter, setStatusFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return searchParams.get("status") ?? sessionStorage.getItem("jobsStatusFilter") ?? "";
    }
    return searchParams.get("status") ?? "";
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarHeight, setToolbarHeight] = useState(52);

  useEffect(() => {
    if (!toolbarRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.borderBoxSize?.[0]?.blockSize) {
          setToolbarHeight(entry.borderBoxSize[0].blockSize);
        } else {
          setToolbarHeight(entry.contentRect.height);
        }
      }
    });
    observer.observe(toolbarRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // If we are on the default view, jobsPromise (server-streamed) provides the data.
  // We only fetch from client if filters/sorting differ from the default or change.
  const isDefaultView = sortKey === "created_at" && sortOrder === "desc" && !statusFilter && !debouncedSearch && !starredOnly;
  const isFirstRun = useRef(true);

  const fetchJobs = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("sort", sortKey);
    params.set("order", sortOrder);
    if (statusFilter && !starredOnly) params.set("status", statusFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (starredOnly) params.set("starred", "1");
    const res = await fetch(`/api/jobs?${params}`);
    const data = await res.json();
    fetchedFromClient.current = true;
    setJobs(data.jobs ?? []);
    setLoading(false);
  }, [sortKey, sortOrder, statusFilter, debouncedSearch, starredOnly]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      if (isDefaultView) {
        // jobsPromise will supply the initial list
        return;
      }
    }
    fetchJobs();
  }, [fetchJobs, isDefaultView]);

  const [restoring, setRestoring] = useState(false);
  const autoClosedJobs = useMemo(
    () => jobs.filter((j) => j.status === "closed" && !!j.previous_status),
    [jobs],
  );
  // Dismissal is remembered per set of jobs, so a newly auto-closed job brings the banner back.
  const [dismissedAutoClosed, setDismissedAutoClosed] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("dismissedAutoClosed") ?? "[]") as number[]); } catch { return new Set(); }
  });
  const showAutoClosed = autoClosedJobs.some((j) => !dismissedAutoClosed.has(j.id));
  const dismissAutoClosed = () => {
    const ids = new Set(autoClosedJobs.map((j) => j.id));
    localStorage.setItem("dismissedAutoClosed", JSON.stringify([...ids]));
    setDismissedAutoClosed(ids);
  };

  const undoAutoClosed = async () => {
    setRestoring(true);
    try {
      const res = await fetch("/api/jobs/check-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo" }),
      });
      const data = await res.json();
      if (data.restored) {
        setImportMsg(`Successfully restored ${data.restored} job${data.restored === 1 ? "" : "s"} back to their active pipeline statuses.`);
        fetchJobs();
      }
    } catch {
      setImportMsg("Failed to restore jobs.");
    } finally {
      setRestoring(false);
    }
  };

  const updateStatusFilter = (value: string) => {
    setStatusFilter(value);
    if (value) sessionStorage.setItem("jobsStatusFilter", value);
    else sessionStorage.removeItem("jobsStatusFilter");
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("status", value);
    else params.delete("status");
    router.replace(`/jobs?${params}`, { scroll: false });
  };

  const checkClosed = useCallback(async () => {
    window.dispatchEvent(new CustomEvent("jobs-action-status", { detail: { checking: true } }));
    setImportMsg("");
    try {
      const res = await fetch("/api/jobs/check-status", { method: "POST" });
      const data: { checked?: number; closed?: number; closedJobs?: { company: string; title?: string; reason?: string }[] } = await res.json();
      if (data.closed && data.closed > 0) {
        const names = data.closedJobs?.map((j) => `${j.company}${j.title ? ` — ${j.title}` : ""}`).join(", ") ?? "";
        setImportMsg(`Checked ${data.checked} jobs — ${data.closed} closed and marked${names ? `: ${names}` : ""}.`);
        fetchJobs();
      } else {
        setImportMsg(`Checked ${data.checked ?? 0} active jobs — all postings are still open.`);
      }
    } catch {
      setImportMsg("Failed to check job URLs.");
    } finally {
      window.dispatchEvent(new CustomEvent("jobs-action-status", { detail: { checking: false } }));
    }
  }, [fetchJobs]);

  useEffect(() => {
    const handleImport = () => { setIsImportModalOpen(true); };
    const handleCheckClosed = () => { checkClosed(); };
    window.addEventListener("jobs-action-import", handleImport);
    window.addEventListener("jobs-action-check-closed", handleCheckClosed);
    return () => {
      window.removeEventListener("jobs-action-import", handleImport);
      window.removeEventListener("jobs-action-check-closed", handleCheckClosed);
    };
  }, [checkClosed]);

  const handleSortChange = (newSort: TableSortState<string>) => {
    if (newSort.length === 0) return;
    const { sortKey: key, direction } = newSort[0];
    const newOrder = direction === "ascending" ? "asc" : "desc";
    setSortKey(key as SortKey);
    setSortOrder(newOrder);
    sessionStorage.setItem("jobsSortKey", key);
    sessionStorage.setItem("jobsSortOrder", newOrder);
  };

  const sortablePlugin = useTableSortable<JobRow & Record<string, unknown>>({
    sort: [{ sortKey, direction: sortOrder === "asc" ? "ascending" : "descending" }],
    onSortChange: handleSortChange,
  });

  const toggleStar = async (job: JobRow) => {
    const newVal = job.is_starred ? 0 : 1;
    await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_starred: newVal }),
    });
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_starred: newVal } : j));
  };

  const allColumns: TableColumn<JobRow & Record<string, unknown>>[] = [
    {
      key: "is_starred",
      header: "★",
      width: pixel(40),
      renderCell: (job) => (
        <button
          onClick={(e) => { e.preventDefault(); toggleStar(job); }}
          className={`text-lg leading-none transition ${job.is_starred ? "text-amber-400" : "text-disabled hover:text-amber-300"}`}
        >
          {job.is_starred ? "★" : "☆"}
        </button>
      ),
    },
    {
      key: "company",
      header: "Company",
      width: proportional(1.5),
      sortable: true,
      renderCell: (job) => (
        <Link href={`/jobs/${job.id}`} className="font-medium text-primary hover:text-accent">
          {job.company || "—"}
        </Link>
      ),
    },
    {
      key: "title",
      header: "Title",
      width: proportional(2),
      sortable: true,
      renderCell: (job) => (
        <Link href={`/jobs/${job.id}`} className="block truncate text-secondary hover:text-accent">
          {job.title || "—"}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: pixel(isMobile ? 110 : 150),
      sortable: true,
      renderCell: (job) => (
        <Selector
          label="Status"
          isLabelHidden
          size="sm"
          startIcon={<JobStatusDot status={job.status} />}
          options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, icon: <JobStatusDot status={s.value} /> }))}
          value={job.status}
          onChange={async (v) => {
            await fetch(`/api/jobs/${job.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: v }),
            });
            fetchJobs();
          }}
        />
      ),
    },
    {
      key: "salary_max",
      header: "Salary",
      width: proportional(1.2),
      sortable: true,
      renderCell: (job) => <Text>{formatSalary(job)}</Text>,
    },
    {
      key: "location",
      header: "Location",
      width: proportional(1),
      sortable: true,
      renderCell: (job) => <Text>{job.location || "—"}</Text>,
    },
    {
      // The pursuit score. Carries the color, because it is the number that
      // makes a recommendation.
      key: "fitness_score",
      header: "Fitness",
      width: pixel(90),
      sortable: true,
      renderCell: (job) =>
        job.fitness_score != null
          ? <Badge variant={BAND_VARIANTS[bandForScore(job.fitness_score)] ?? "neutral"} label={`${job.fitness_score}/10`} />
          : <Text>—</Text>,
    },
    {
      key: "match_score",
      header: "ATS Match",
      width: pixel(90),
      sortable: true,
      renderCell: (job) =>
        job.match_score != null
          ? (
            <span title={job.match_resume_name ? `Scored with: ${job.match_resume_name}` : undefined}>
              <Badge variant="neutral" label={`${job.match_score}%`} />
            </span>
          )
          : <Text>—</Text>,
    },
    {
      key: "created_at",
      header: "Added",
      width: pixel(80),
      sortable: true,
      renderCell: (job) => <Text>{formatDate(job.created_at)}</Text>,
    },
    {
      key: "applied_at",
      header: "Applied",
      width: pixel(80),
      sortable: true,
      renderCell: (job) => <Text>{formatDate(job.applied_at)}</Text>,
    },
  ];

  // On mobile, keep only what's useful at a glance — Company/Title/Status —
  // so the table fits a phone width without horizontal scrolling.
  const MOBILE_HIDDEN_COLUMNS = new Set(["salary_max", "location", "match_score", "fitness_score", "created_at", "applied_at"]);
  const columns = isMobile ? allColumns.filter((c) => !MOBILE_HIDDEN_COLUMNS.has(c.key)) : allColumns;

  const statusOptions = [
    { value: "", label: "All statuses" },
    ...STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
  ];

  return (
    <div className="flex flex-col" style={{ "--table-header-top": `${56 + toolbarHeight}px` } as React.CSSProperties}>
      <div ref={toolbarRef} className="sticky top-[56px] z-20 bg-surface border-b border-border/40 py-2.5 before:absolute before:-top-4 before:left-0 before:right-0 before:h-4 before:bg-surface">
        <Stack gap={3} className="shrink-0">
          <HStack gap={3} className="flex-wrap items-center">
            <TextInput
              label="Search"
              isLabelHidden
              value={search}
              onChange={setSearch}
              placeholder="Search jobs…"
              className="w-48"
            />
            <Selector
              label="Status filter"
              isLabelHidden
              options={statusOptions}
              value={statusFilter}
              onChange={(v) => updateStatusFilter(v as string)}
              placeholder="All statuses"
              className="w-36"
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-sm select-none">
              <input type="checkbox" checked={starredOnly} onChange={(e) => setStarredOnly(e.target.checked)} className="accent-amber-400" />
              <span className={starredOnly ? "text-amber-500 font-medium" : "text-secondary"}>★ Starred</span>
            </label>
          </HStack>

          {showAutoClosed && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm">
                  ⚠️ <strong>{autoClosedJobs.length}</strong> job{autoClosedJobs.length === 1 ? " was" : "s were"} recently marked closed by an automated check — the posting looks to be taken down. Check it before restoring.
                </span>
                <HStack gap={2} className="items-center">
                  <Button
                    label={restoring ? "Restoring…" : "Restore to active pipeline"}
                    variant="secondary"
                    size="sm"
                    onClick={undoAutoClosed}
                    isDisabled={restoring}
                  />
                  <button
                    type="button"
                    onClick={dismissAutoClosed}
                    aria-label="Dismiss"
                    title="Dismiss"
                    className="rounded p-1 text-amber-900/70 hover:bg-amber-500/15 hover:text-amber-900 dark:text-amber-100/70 dark:hover:text-amber-100 cursor-pointer"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </HStack>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {autoClosedJobs.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">
                      {j.company || "Unknown company"} — {j.title || "Untitled"}
                    </Link>
                    <span className="text-xs text-amber-900/70 dark:text-amber-100/70">was {STATUS_OPTIONS.find((s) => s.value === j.previous_status)?.label ?? j.previous_status}</span>
                    {j.url && (
                      <a href={j.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium underline hover:no-underline">
                        View posting ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {importMsg && <Banner status="info" title={importMsg} isDismissable onDismiss={() => setImportMsg("")} />}
        </Stack>
      </div>

      <div className="mt-1 flex flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Spinner label="Loading jobs…" />
          </div>
        ) : jobs.length === 0 ? (
          <Stack gap={1} className="py-12 text-center">
            <Text type="body">No jobs tracked yet.</Text>
            <Text type="supporting">Add a job manually, import from your Google Sheet, or paste a job posting URL.</Text>
          </Stack>
        ) : (
          <div className="sticky-table-header">
            <Table
              data={jobs as (JobRow & Record<string, unknown>)[]}
              columns={columns}
              idKey="id"
              hasHover
              plugins={{ sortable: sortablePlugin }}
            />
          </div>
        )}

        <Text type="supporting" display="block" className="mt-3 shrink-0">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</Text>
      </div>

      <ImportSheetModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(msg) => {
          setImportMsg(msg);
          fetchJobs();
        }}
      />

      <OnboardingWizardModal />
    </div>
  );
}
