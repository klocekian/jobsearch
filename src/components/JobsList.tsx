"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import { STATUS_OPTIONS, STATUS_COLORS } from "@/lib/status";
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

type SortKey = "company" | "title" | "status" | "salary_max" | "location" | "match_score" | "created_at" | "applied_at";

function formatSalary(job: JobRow): string {
  if (job.salary_text) return job.salary_text;
  if (job.salary_min && job.salary_max) return `$${(job.salary_min / 1000).toFixed(0)}k–$${(job.salary_max / 1000).toFixed(0)}k`;
  if (job.salary_min) return `$${(job.salary_min / 1000).toFixed(0)}k+`;
  if (job.salary_max) return `Up to $${(job.salary_max / 1000).toFixed(0)}k`;
  return "";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T") + (iso.includes("T") || iso.includes(" ") ? "" : "T00:00:00"));
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const BADGE_VARIANTS: Record<string, "success" | "error" | "warning" | "blue" | "purple" | "teal" | "neutral"> = {
  saved: "neutral",
  applying: "warning",
  applied: "blue",
  interview: "success",
  interview2: "teal",
  onsite: "teal",
  offer: "purple",
  accepted: "success",
  rejected: "error",
  withdrawn: "neutral",
  closed: "neutral",
  abandoned: "neutral",
};

export function JobsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (statusFilter) params.set("status", statusFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);
    const res = await fetch(`/api/jobs?${params}`);
    const data = await res.json();
    setJobs(data.jobs ?? []);
    setLoading(false);
  }, [ready, sortKey, sortOrder, statusFilter, debouncedSearch]);

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

  const columns: TableColumn<JobRow & Record<string, unknown>>[] = [
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
        <Link href={`/jobs/${job.id}`} className="text-secondary hover:text-accent">
          {job.title || "—"}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: pixel(120),
      sortable: true,
      renderCell: (job) => (
        <select
          value={job.status}
          onChange={async (e) => {
            await fetch(`/api/jobs/${job.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: e.target.value }),
            });
            fetchJobs();
          }}
          className={`rounded-full border-0 px-2 py-0.5 text-[10px] font-semibold capitalize cursor-pointer ${STATUS_COLORS[job.status] ?? STATUS_COLORS.saved}`}
        >
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      ),
    },
    {
      key: "salary_max",
      header: "Salary",
      width: proportional(1.2),
      sortable: true,
      renderCell: (job) => <Text type="supporting">{formatSalary(job)}</Text>,
    },
    {
      key: "location",
      header: "Location",
      width: proportional(1),
      sortable: true,
      renderCell: (job) => <Text type="supporting">{job.location || "—"}</Text>,
    },
    {
      key: "match_score",
      header: "Score",
      width: pixel(80),
      sortable: true,
      renderCell: (job) =>
        job.match_score != null
          ? <Badge variant={job.match_score >= 80 ? "success" : job.match_score >= 60 ? "warning" : "neutral"} label={`${job.match_score}%`} />
          : <Text type="supporting">—</Text>,
    },
    {
      key: "created_at",
      header: "Added",
      width: pixel(80),
      sortable: true,
      renderCell: (job) => <Text type="supporting">{formatDate(job.created_at)}</Text>,
    },
    {
      key: "applied_at",
      header: "Applied",
      width: pixel(80),
      sortable: true,
      renderCell: (job) => <Text type="supporting">{formatDate(job.applied_at)}</Text>,
    },
  ];

  const statusOptions = [
    { value: "", label: "All statuses" },
    ...STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
  ];

  return (
    <Stack gap={3}>
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
        <HStack gap={2} className="ml-auto items-center">
          <Button label={checking ? "Checking…" : "Check closed"} variant="ghost" size="sm" onClick={checkClosed} isDisabled={checking} />
          <Button label={importing ? "Importing…" : "Import from Google Sheet"} variant="ghost" size="sm" onClick={importFromSheet} isDisabled={importing} />
          <Button label="Add Job" variant="primary" size="sm" href="/jobs?add=1" />
        </HStack>
      </HStack>

      {importMsg && <Banner status="info" title={importMsg} isDismissable onDismiss={() => setImportMsg("")} />}

      {loading ? (
        <Spinner label="Loading jobs…" />
      ) : jobs.length === 0 ? (
        <Stack gap={1} className="py-12 text-center">
          <Text type="body">No jobs tracked yet.</Text>
          <Text type="supporting">Add a job manually, import from your Google Sheet, or paste a job posting URL.</Text>
        </Stack>
      ) : (
        <Table
          data={jobs as (JobRow & Record<string, unknown>)[]}
          columns={columns}
          idKey="id"
          hasHover
          plugins={{ sortable: sortablePlugin }}
        />
      )}

      <Text type="supporting">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</Text>
    </Stack>
  );
}
