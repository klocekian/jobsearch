"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import { STATUS_OPTIONS, statusLabel } from "@/lib/status";
import { BAND_VARIANTS, bandForScore } from "@/lib/fitness/schema";
import { formatDate, formatSalary } from "@/lib/format";
import { useStoredValue } from "@/hooks/useStoredValue";
import {
  loadDismissedAutoClosed, loadJobListSortKey, loadJobListSortOrder, loadJobListStatus,
  saveDismissedAutoClosed, saveJobListIds, saveJobListSortKey, saveJobListSortOrder, saveJobListStatus,
} from "@/lib/storage";
import { apiGet, apiSend, errorMessage } from "@/lib/api-client";
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

// Bypass the browser cache: /api/jobs allows a short private cache, and lists
// are refetched right after mutations (restore, confirm, import, status checks).
const NO_STORE: RequestInit = { cache: "no-store" };

/**
 * ATS match bands: 90+ is the bar a resume is tuned to (see job-activity),
 * 80s are close, below that needs work. A palette apart from the fitness
 * bands, so the two numbers never read as the same kind of thing.
 */
function matchVariant(score: number): "purple" | "teal" | "error" {
  if (score >= 90) return "purple";
  if (score >= 80) return "teal";
  return "error";
}

interface JobsListProps {
  /** The page's full list, newest first (null until it loads) — the default view. */
  allJobs: JobRow[] | null;
  setAllJobs: Dispatch<SetStateAction<JobRow[] | null>>;
  refreshAllJobs: () => Promise<void>;
}

export function JobsList({ allJobs, setAllJobs, refreshAllJobs }: JobsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 767px)");
  // Any other sort/filter/search is fetched from the server into viewJobs.
  const [viewJobs, setViewJobs] = useState<JobRow[] | null>(null);
  // Remembered per tab; the server renders the defaults and the stored view applies after hydration.
  const [sortKey, setSortKey] = useStoredValue<SortKey>(() => loadJobListSortKey() as SortKey, saveJobListSortKey, "created_at");
  const [sortOrder, setSortOrder] = useStoredValue(loadJobListSortOrder, saveJobListSortOrder, "desc");
  const [storedStatus, setStoredStatus] = useStoredValue(loadJobListStatus, saveJobListStatus, "");
  const statusFilter = searchParams.get("status") ?? storedStatus;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [actionError, setActionError] = useState("");
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

  // The default view is the page's shared list; anything else comes from the
  // server. Until the first filtered fetch lands, keep showing the full list.
  const isDefaultView = sortKey === "created_at" && sortOrder === "desc" && !statusFilter && !debouncedSearch && !starredOnly;
  const jobs = useMemo(
    () => (isDefaultView ? allJobs : viewJobs ?? allJobs) ?? [],
    [isDefaultView, allJobs, viewJobs],
  );
  const loading = allJobs === null && (isDefaultView || viewJobs === null);

  useEffect(() => {
    if (jobs.length > 0) {
      try {
        saveJobListIds(jobs.map((j) => j.id));
      } catch {}
    }
  }, [jobs]);

  const viewUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("sort", sortKey);
    params.set("order", sortOrder);
    if (statusFilter && !starredOnly) params.set("status", statusFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (starredOnly) params.set("starred", "1");
    return `/api/jobs?${params}`;
  }, [sortKey, sortOrder, statusFilter, debouncedSearch, starredOnly]);

  useEffect(() => {
    if (isDefaultView) return;
    let ignore = false;
    apiGet<{ jobs?: JobRow[] }>(viewUrl, NO_STORE)
      .then((data) => { if (!ignore) setViewJobs(data.jobs ?? []); })
      .catch(() => {}); // keep showing the last list
    return () => { ignore = true; };
  }, [isDefaultView, viewUrl]);

  const fetchView = useCallback(async () => {
    try {
      const data = await apiGet<{ jobs?: JobRow[] }>(viewUrl, NO_STORE);
      setViewJobs(data.jobs ?? []);
    } catch {
      // keep showing the last list
    }
  }, [viewUrl]);

  // After a write: reload the shared list (banner, funnel, default view) and
  // the filtered view if one is showing.
  const fetchJobs = useCallback(async () => {
    await Promise.all([refreshAllJobs(), isDefaultView ? null : fetchView()]);
  }, [refreshAllJobs, isDefaultView, fetchView]);

  const patchLocal = (id: number, fields: Partial<JobRow>) => {
    const patch = (list: JobRow[] | null) => list?.map((j) => (j.id === id ? { ...j, ...fields } : j)) ?? null;
    setAllJobs(patch);
    setViewJobs(patch);
  };

  const [restoring, setRestoring] = useState(false);
  const autoClosedJobs = useMemo(
    () => jobs.filter((j) => j.status === "closed" && !!j.auto_closed && !!j.previous_status),
    [jobs],
  );
  // Dismissal is remembered per set of jobs, so a newly auto-closed job brings the banner back.
  // Kept as a JSON string so useStoredValue can compare snapshots by value.
  const [dismissedJson, setDismissedJson] = useStoredValue(
    () => JSON.stringify(loadDismissedAutoClosed()),
    (json) => saveDismissedAutoClosed(JSON.parse(json) as number[]),
    "[]",
  );
  const dismissedAutoClosed = useMemo(() => new Set(JSON.parse(dismissedJson) as number[]), [dismissedJson]);
  const showAutoClosed = autoClosedJobs.some((j) => !dismissedAutoClosed.has(j.id));
  const dismissAutoClosed = () => {
    setDismissedJson(JSON.stringify(autoClosedJobs.map((j) => j.id)));
  };

  const [confirming, setConfirming] = useState(false);
  const confirmAutoClosed = async () => {
    setConfirming(true);
    try {
      const data = await apiSend<{ confirmed: number }>("/api/jobs/check-status", "POST", {
        action: "confirm",
        job_ids: autoClosedJobs.map((j) => j.id),
      });
      setImportMsg(`Saved — ${data.confirmed} job${data.confirmed === 1 ? " stays" : "s stay"} closed.`);
      fetchJobs();
    } catch {
      setImportMsg("Failed to save closed jobs.");
    } finally {
      setConfirming(false);
    }
  };

  const undoAutoClosed = async () => {
    setRestoring(true);
    try {
      const data = await apiSend<{ restored?: number }>("/api/jobs/check-status", "POST", { action: "undo" });
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
    setStoredStatus(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("status", value);
    else params.delete("status");
    router.replace(`/jobs?${params}`, { scroll: false });
  };

  const checkClosed = useCallback(async () => {
    window.dispatchEvent(new CustomEvent("jobs-action-status", { detail: { checking: true } }));
    setImportMsg("");
    try {
      const data = await apiSend<{ checked?: number; closed?: number; closedJobs?: { company: string; title?: string; reason?: string }[] }>(
        "/api/jobs/check-status", "POST",
      );
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
  };

  const sortablePlugin = useTableSortable<JobRow & Record<string, unknown>>({
    sort: [{ sortKey, direction: sortOrder === "asc" ? "ascending" : "descending" }],
    onSortChange: handleSortChange,
  });

  const toggleStar = async (job: JobRow) => {
    const newVal = job.is_starred ? 0 : 1;
    setActionError("");
    try {
      await apiSend(`/api/jobs/${job.id}`, "PATCH", { is_starred: newVal });
    } catch (err) {
      setActionError(errorMessage(err, "Could not update the star."));
      return;
    }
    patchLocal(job.id, { is_starred: newVal });
  };

  const changeStatus = async (job: JobRow, status: string) => {
    setActionError("");
    let updated: JobRow;
    try {
      ({ job: updated } = await apiSend<{ job: JobRow }>(`/api/jobs/${job.id}`, "PATCH", { status }));
    } catch (err) {
      setActionError(errorMessage(err, "Could not change the status."));
      return;
    }
    // The route returns the row with its status side effects (applied_at,
    // previous_status) applied, so the shared list updates without a refetch.
    patchLocal(job.id, updated);
    if (!isDefaultView) fetchView();
  };

  const allColumns: TableColumn<JobRow & Record<string, unknown>>[] = [
    {
      key: "is_starred",
      header: "★",
      width: pixel(40),
      renderCell: (job) => (
        <button
          onClick={(e) => { e.preventDefault(); toggleStar(job); }}
          className={`text-lg leading-none transition ${job.is_starred ? "text-amber-600 dark:text-amber-400" : "text-disabled hover:text-amber-600 dark:hover:text-amber-400"}`}
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
          onChange={(v) => changeStatus(job, v)}
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
      // The pursuit score: the number that makes a recommendation.
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
              <Badge variant={matchVariant(job.match_score)} label={`${job.match_score}%`} />
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
              <span className={starredOnly ? "text-amber-700 dark:text-amber-400 font-medium" : "text-secondary"}>★ Starred</span>
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
                    label={confirming ? "Saving…" : "This looks correct. Save."}
                    variant="primary"
                    size="sm"
                    onClick={confirmAutoClosed}
                    isDisabled={confirming || restoring}
                  />
                  <Button
                    label={restoring ? "Restoring…" : "Restore to active pipeline"}
                    variant="secondary"
                    size="sm"
                    onClick={undoAutoClosed}
                    isDisabled={restoring || confirming}
                  />
                  <button
                    type="button"
                    onClick={dismissAutoClosed}
                    aria-label="Dismiss"
                    title="Dismiss"
                    className="rounded p-1 text-amber-900/80 hover:bg-amber-500/15 hover:text-amber-900 dark:text-amber-100/80 dark:hover:text-amber-100 cursor-pointer"
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
                    <span className="text-xs text-amber-900/80 dark:text-amber-100/80">was {j.previous_status && statusLabel(j.previous_status)}</span>
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
          {actionError && <Banner status="error" title={actionError} isDismissable onDismiss={() => setActionError("")} />}
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
