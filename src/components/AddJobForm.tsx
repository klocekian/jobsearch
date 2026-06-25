"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddJobForm() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [remoteType, setRemoteType] = useState("");
  const [salaryText, setSalaryText] = useState("");
  const [postingText, setPostingText] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [fetchMsg, setFetchMsg] = useState("");
  const [extractStatus, setExtractStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [extractMsg, setExtractMsg] = useState("");

  const fetchFromUrl = async () => {
    if (!url.trim()) return;
    setFetchStatus("loading");
    setFetchMsg("");
    try {
      const res = await fetch("/api/fetch-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data: { company?: string; jobTitle?: string; jobDescription?: string; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
      if (data.company) setCompany(data.company);
      if (data.jobTitle) setTitle(data.jobTitle);
      if (data.jobDescription) setPostingText(data.jobDescription);
      setFetchStatus("done");
      setFetchMsg("Filled from posting — review and edit as needed.");
    } catch (err: unknown) {
      setFetchStatus("error");
      setFetchMsg(err instanceof Error ? err.message : "Couldn't fetch. Paste the posting below instead.");
    }
  };

  const extractFromText = async () => {
    if (!postingText.trim()) return;
    setExtractStatus("loading");
    setExtractMsg("");
    try {
      const res = await fetch("/api/jobs/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: postingText.trim(), url: url.trim() || undefined }),
      });
      const data = await res.json() as {
        company?: string; jobTitle?: string; location?: string;
        remoteType?: string; salaryText?: string; jobDescription?: string; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Extraction failed.");
      if (data.company && !company) setCompany(data.company);
      if (data.jobTitle && !title) setTitle(data.jobTitle);
      if (data.location && !location) setLocation(data.location);
      if (data.remoteType && !remoteType) setRemoteType(data.remoteType);
      if (data.salaryText && !salaryText) setSalaryText(data.salaryText);
      if (data.jobDescription) setPostingText(data.jobDescription);
      setExtractStatus("done");
      setExtractMsg("Extracted — review the fields above.");
    } catch (err: unknown) {
      setExtractStatus("error");
      setExtractMsg(err instanceof Error ? err.message : "Extraction failed.");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          title,
          url,
          location,
          remote_type: remoteType,
          salary_text: salaryText,
          posting_text: postingText,
          notes,
          source: url ? "url" : "manual",
        }),
      });
      const data: { job?: { id: number }; merged?: boolean; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      router.push(`/jobs/${data.job!.id}${data.merged ? "?merged=1" : ""}`);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Job Posting URL</label>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://careers.example.com/job/12345"
          />
          <button
            type="button"
            onClick={fetchFromUrl}
            disabled={!url.trim() || fetchStatus === "loading"}
            className="shrink-0 rounded-lg border border-brand px-4 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white disabled:opacity-50"
          >
            {fetchStatus === "loading" ? "Fetching…" : "Fetch"}
          </button>
        </div>
        {fetchStatus === "done" && <p className="mt-1 text-xs text-emerald-600">{fetchMsg}</p>}
        {fetchStatus === "error" && <p className="mt-1 text-xs text-rose-500">{fetchMsg}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Company</label>
          <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Google" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Job Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Director, UX" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Location</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="San Francisco, CA" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Remote</label>
          <select className="input" value={remoteType} onChange={(e) => setRemoteType(e.target.value)}>
            <option value="">—</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Salary</label>
          <input className="input" value={salaryText} onChange={(e) => setSalaryText(e.target.value)} placeholder="$150k–$200k" />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-600">
            Job Description (paste the full posting)
          </label>
          <button
            type="button"
            onClick={extractFromText}
            disabled={!postingText.trim() || extractStatus === "loading"}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {extractStatus === "loading" ? "Extracting…" : "Extract fields from text"}
          </button>
        </div>
        <textarea
          className="input h-64 resize-y font-mono text-xs leading-relaxed"
          value={postingText}
          onChange={(e) => setPostingText(e.target.value)}
          placeholder="Paste the full job posting here. Select all the text on the job page, copy it, and paste it here — then click 'Extract fields from text' to auto-fill the fields above."
        />
        {extractStatus === "done" && <p className="mt-1 text-xs text-emerald-600">{extractMsg}</p>}
        {extractStatus === "error" && <p className="mt-1 text-xs text-rose-500">{extractMsg}</p>}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Notes (optional)</label>
        <textarea
          className="input h-20 resize-y text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes — who referred you, why you're interested, etc."
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving || (!company.trim() && !title.trim())}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Job"}
        </button>
        <button
          onClick={() => router.push("/jobs")}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
