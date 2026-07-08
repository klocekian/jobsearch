"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import { STATUS_OPTIONS } from "@/lib/status";
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

type SortKey = "company" | "title" | "status" | "salary_max" | "location" | "match_score" | "created_at" | "applied_at";

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
    });
  }, [jobsPromise]);
  const [sortKey, setSortKey] = useState<SortKey>(() =>
    (typeof window !== "undefined" && sessionStorage.getItem("jobsSortKey") as SortKey) || "created_at"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() =>
    (typeof window !== "undefined" && sessionStorage.getItem("jobsSortOrder") as "asc" | "desc") || "desc"
  );
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    if (!searchParams.get("status")) {
      const stored = sessionStorage.getItem("jobsStatusFilter");
      if (stored) {
        setStatusFilter(stored);
        router.replace(`/jobs?status=${encodeURIComponent(stored)}`, { scroll: false });
      }
    }
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchJobs = useCallback(async () => {
    if (!ready) return;
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
  }, [ready, sortKey, sortOrder, statusFilter, debouncedSearch, starredOnly]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    const key = "jobsLastUrlCheck";
    const last = localStorage.getItem(key);
    const today = new Date().toISOString().slice(0, 10);
    if (last === today) return;
    localStorage.setItem(key, today);
    fetch("/api/jobs/check-status", { method: "POST" })
      .then((r) => r.json())
      .then((d: { closed?: number }) => {
        if (d.closed && d.closed > 0) fetchJobs();
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatusFilter = (value: string) => {
    setStatusFilter(value);
    if (value) sessionStorage.setItem("jobsStatusFilter", value);
    else sessionStorage.removeItem("jobsStatusFilter");
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("status", value);
    else params.delete("status");
    router.replace(`/jobs?${params}`, { scroll: false });
  };

  const importFromSheet = async () => {
    setImporting(true);
    setImportMsg("");
    try {
      const res = await fetch("/api/jobs/import", { method: "POST" });
      const data: { imported?: number; skipped?: number; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setImportMsg(`Imported ${data.imported} jobs${data.skipped ? `, ${data.skipped} already existed` : ""}.`);
      fetchJobs();
    } catch (err: unknown) {
      setImportMsg(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const checkClosed = async () => {
    setChecking(true);
    setImportMsg("");
    try {
      const res = await fetch("/api/jobs/check-status", { method: "POST" });
      const data: { checked?: number; closed?: number; closedJobs?: { company: string }[] } = await res.json();
      if (data.closed && data.closed > 0) {
        const names = data.closedJobs?.map((j) => j.company).join(", ") ?? "";
        setImportMsg(`Checked ${data.checked} jobs — ${data.closed} now closed${names ? `: ${names}` : ""}.`);
        fetchJobs();
      } else {
        setImportMsg(`Checked ${data.checked ?? 0} jobs — all still open.`);
      }
    } catch {
      setImportMsg("Failed to check job URLs.");
    } finally {
      setChecking(false);
    }
  };

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
          className={`text-lg leading-none transition ${job.is_starred ? "text-amber-400" : "text-slate-200 hover:text-amber-300"}`}
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
      key: "match_score",
      header: "Score",
      width: pixel(80),
      sortable: true,
      renderCell: (job) =>
        job.match_score != null
          ? <Badge variant={job.match_score >= 80 ? "success" : job.match_score >= 60 ? "warning" : "neutral"} label={`${job.match_score}%`} />
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
  const MOBILE_HIDDEN_COLUMNS = new Set(["salary_max", "location", "match_score", "created_at", "applied_at"]);
  const columns = isMobile ? allColumns.filter((c) => !MOBILE_HIDDEN_COLUMNS.has(c.key)) : allColumns;

  const statusOptions = [
    { value: "", label: "All statuses" },
    ...STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
  ];

  return (
    <div className="flex h-full flex-col">
      <Stack gap={3} className="shrink-0">
        <HStack gap={3} className="flex-wrap items-center">
          <TextInput
            label="Search"
            isLabelHidden
            value={search}
            onChange={setSearch}
            placeholder="Search jobs…"
            className="w-40"
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
          <HStack gap={2} className="items-center sm:ml-auto">
            <Button label={checking ? "Checking…" : "Check closed"} variant="ghost" size="sm" onClick={checkClosed} isDisabled={checking} />
            <Button label={importing ? "Importing…" : isMobile ? "Import" : "Import from Google Sheet"} variant="ghost" size="sm" onClick={importFromSheet} isDisabled={importing} />
            <Button label="Add Job" variant="primary" size="sm" href="/jobs?add=1" />
          </HStack>
        </HStack>

        {importMsg && <Banner status="info" title={importMsg} isDismissable onDismiss={() => setImportMsg("")} />}
      </Stack>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {loading ? (
          <Spinner label="Loading jobs…" />
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
    </div>
  );
}
