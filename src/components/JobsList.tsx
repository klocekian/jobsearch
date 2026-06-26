"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";

type SortKey = "company" | "title" | "status" | "salary_max" | "location" | "match_score" | "created_at" | "applied_at";

const STATUS_COLORS: Record<string, string> = {
  saved: "bg-slate-100 text-slate-600",
  applying: "bg-amber-50 text-amber-700",
  applied: "bg-blue-50 text-blue-700",
  interview: "bg-emerald-50 text-emerald-700",
  offer: "bg-purple-50 text-purple-700",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-rose-50 text-rose-600",
  declined: "bg-orange-50 text-orange-600",
  withdrawn: "bg-slate-100 text-slate-500",
  abandoned: "bg-stone-100 text-stone-500",
  closed: "bg-slate-100 text-slate-400",
};

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

export function JobsList() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const fetchJobs = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("sort", sortKey);
    params.set("order", sortOrder);
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/jobs?${params}`);
    const data = await res.json();
    setJobs(data.jobs ?? []);
    setLoading(false);
  }, [sortKey, sortOrder, statusFilter, search]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder(key === "company" || key === "title" ? "asc" : "desc");
    }
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

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="cursor-pointer px-3 py-2 text-left text-xs font-medium text-slate-500 transition hover:text-slate-800 select-none"
      onClick={() => toggleSort(field)}
    >
      {label}
      {sortKey === field && (
        <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>
      )}
    </th>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search jobs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input max-w-[160px]"
        >
          <option value="">All statuses</option>
          <option value="saved">Saved</option>
          <option value="applying">Applying</option>
          <option value="applied">Applied</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="declined">Declined</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="abandoned">Abandoned</option>
          <option value="closed">Closed</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={importFromSheet}
            disabled={importing}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import from Google Sheet"}
          </button>
          <Link
            href="/jobs?add=1"
            className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
          >
            Add Job
          </Link>
        </div>
      </div>

      {importMsg && (
        <p className="mb-3 text-xs text-slate-600">{importMsg}</p>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <p className="text-sm text-slate-500">No jobs tracked yet.</p>
          <p className="mt-1 text-xs text-slate-400">
            Add a job manually, import from your Google Sheet, or paste a job posting URL.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/50">
              <tr>
                <SortHeader label="Company" field="company" />
                <SortHeader label="Title" field="title" />
                <SortHeader label="Status" field="status" />
                <SortHeader label="Salary" field="salary_max" />
                <SortHeader label="Location" field="location" />
                <SortHeader label="Score" field="match_score" />
                <SortHeader label="Added" field="created_at" />
                <SortHeader label="Applied" field="applied_at" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="transition hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <Link href={`/jobs/${job.id}`} className="font-medium text-slate-800 hover:text-brand">
                      {job.company || "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/jobs/${job.id}`} className="text-slate-600 hover:text-brand">
                      {job.title || "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={job.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        await fetch(`/api/jobs/${job.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: newStatus }),
                        });
                        fetchJobs();
                      }}
                      className={`rounded-full border-0 px-2 py-0.5 text-[10px] font-semibold capitalize cursor-pointer ${STATUS_COLORS[job.status] ?? STATUS_COLORS.saved}`}
                    >
                      <option value="saved">Saved</option>
                      <option value="applying">Applying</option>
                      <option value="applied">Applied</option>
                      <option value="interview">Interview</option>
                      <option value="offer">Offer</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                      <option value="declined">Declined</option>
                      <option value="withdrawn">Withdrawn</option>
                      <option value="abandoned">Abandoned</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{formatSalary(job)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{job.location || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {job.match_score != null ? `${job.match_score}%` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{formatDate(job.created_at)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{formatDate(job.applied_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</p>
    </div>
  );
}
