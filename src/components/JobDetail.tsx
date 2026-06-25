"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import type { SubmissionRow } from "@/lib/db/submissions";

const STATUS_OPTIONS = [
  { value: "saved", label: "Saved" },
  { value: "applying", label: "Applying" },
  { value: "applied", label: "Applied" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "closed", label: "Closed" },
];

const STATUS_COLORS: Record<string, string> = {
  saved: "bg-slate-100 text-slate-600",
  applying: "bg-amber-50 text-amber-700",
  applied: "bg-blue-50 text-blue-700",
  interview: "bg-emerald-50 text-emerald-700",
  offer: "bg-purple-50 text-purple-700",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-rose-50 text-rose-600",
  withdrawn: "bg-slate-100 text-slate-500",
  closed: "bg-slate-100 text-slate-400",
};

type Tab = "posting" | "notes" | "submissions";

export function JobDetail({ jobId }: { jobId: number }) {
  const router = useRouter();
  const [job, setJob] = useState<JobRow | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("posting");
  const [editing, setEditing] = useState(false);

  const [editCompany, setEditCompany] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editRemoteType, setEditRemoteType] = useState("");
  const [editSalaryText, setEditSalaryText] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPostingText, setEditPostingText] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState("");

  const fetchJob = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) { setLoading(false); return; }
    const data: { job: JobRow; submissions: SubmissionRow[] } = await res.json();
    setJob(data.job);
    setSubmissions(data.submissions);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  const startEdit = () => {
    if (!job) return;
    setEditCompany(job.company);
    setEditTitle(job.title);
    setEditUrl(job.url);
    setEditLocation(job.location);
    setEditRemoteType(job.remote_type);
    setEditSalaryText(job.salary_text);
    setEditNotes(job.notes);
    setEditPostingText(job.posting_text);
    setEditing(true);
  };

  const saveEdit = async () => {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: editCompany,
        title: editTitle,
        url: editUrl,
        location: editLocation,
        remote_type: editRemoteType,
        salary_text: editSalaryText,
        notes: editNotes,
        posting_text: editPostingText,
      }),
    });
    setEditing(false);
    fetchJob();
  };

  const updateStatus = async (status: string) => {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchJob();
  };

  const deleteJob = async () => {
    if (!confirm("Delete this job and all its submissions?")) return;
    await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    router.push("/jobs");
  };

  const uploadFile = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", "other");
    form.append("label", file.name);
    await fetch(`/api/jobs/${jobId}/submissions`, { method: "POST", body: form });
    fetchJob();
  };

  const saveTextSubmission = async (type: string, label: string, format: string, content: string) => {
    await fetch(`/api/jobs/${jobId}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, label, format, content }),
    });
    fetchJob();
  };

  const pasteAndExtract = async () => {
    if (!pasteText.trim()) return;
    setExtracting(true);
    setExtractMsg("");
    try {
      const res = await fetch("/api/jobs/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText.trim(), url: job?.url || undefined }),
      });
      const data = await res.json() as {
        company?: string; jobTitle?: string; location?: string;
        remoteType?: string; salaryText?: string; jobDescription?: string; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Extraction failed.");

      const patch: Record<string, string> = {};
      if (data.company && !job?.company) patch.company = data.company;
      if (data.jobTitle && !job?.title) patch.title = data.jobTitle;
      if (data.location && !job?.location) patch.location = data.location;
      if (data.remoteType && !job?.remote_type) patch.remote_type = data.remoteType;
      if (data.salaryText && !job?.salary_text) patch.salary_text = data.salaryText;
      if (data.jobDescription && (!job?.posting_text || data.jobDescription.length > job.posting_text.length)) {
        patch.posting_text = data.jobDescription;
      }

      const filled = Object.keys(patch);
      if (filled.length === 0 && data.jobDescription) {
        patch.posting_text = data.jobDescription;
      }

      if (Object.keys(patch).length > 0) {
        await fetch(`/api/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      }

      setExtractMsg(filled.length > 0 ? `Updated: ${filled.join(", ")}` : "No new fields to fill.");
      setPasting(false);
      setPasteText("");
      fetchJob();
    } catch (err: unknown) {
      setExtractMsg(err instanceof Error ? err.message : "Failed.");
    } finally {
      setExtracting(false);
    }
  };

  const pasteDirect = async () => {
    if (!pasteText.trim()) return;
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posting_text: pasteText.trim() }),
    });
    setPasting(false);
    setPasteText("");
    setExtractMsg("");
    fetchJob();
  };

  const deleteSubmission = async (sid: number) => {
    await fetch(`/api/jobs/${jobId}/submissions/${sid}`, { method: "DELETE" });
    fetchJob();
  };

  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Loading…</p>;
  if (!job) return <p className="py-12 text-center text-sm text-slate-500">Job not found.</p>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/jobs" className="mb-2 inline-block text-xs text-slate-400 hover:text-slate-600">
            ← All jobs
          </Link>
          <h2 className="text-xl font-bold text-slate-900">{job.title || "Untitled"}</h2>
          <p className="text-sm text-slate-500">
            {job.company}
            {job.location && <span> · {job.location}</span>}
            {job.remote_type && <span className="ml-1 text-xs text-slate-400">({job.remote_type})</span>}
            {job.salary_text && <span> · {job.salary_text}</span>}
          </p>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
              View original posting ↗
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={job.status}
            onChange={(e) => updateStatus(e.target.value)}
            className={`rounded-full border-0 px-3 py-1 text-xs font-semibold capitalize ${STATUS_COLORS[job.status] ?? ""}`}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/?jobId=${job.id}`}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Analyze Match
        </Link>
        <button
          onClick={startEdit}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Edit
        </button>
        <button
          onClick={deleteJob}
          className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50"
        >
          Delete
        </button>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Edit Job</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Company</label>
                <input className="input" value={editCompany} onChange={(e) => setEditCompany(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Title</label>
                <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">URL</label>
              <input className="input" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Location</label>
                <input className="input" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Remote</label>
                <select className="input" value={editRemoteType} onChange={(e) => setEditRemoteType(e.target.value)}>
                  <option value="">—</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Salary</label>
                <input className="input" value={editSalaryText} onChange={(e) => setEditSalaryText(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Job Posting Text</label>
              <textarea className="input h-48 resize-y font-mono text-xs" value={editPostingText} onChange={(e) => setEditPostingText(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
              <textarea className="input h-20 resize-y text-sm" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Save</button>
              <button onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {([
          ["posting", "Job Posting"],
          ["submissions", `Submissions (${submissions.length})`],
          ["notes", "Notes"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === key ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "posting" && (
        <div className="space-y-3">
          {!pasting && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPasting(true)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {job.posting_text ? "Paste updated posting" : "Paste job posting"}
              </button>
              {extractMsg && <span className="text-xs text-emerald-600">{extractMsg}</span>}
            </div>
          )}

          {pasting && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs text-slate-500">
                Select all text on the job posting page, copy it, and paste it here.
              </p>
              <textarea
                className="input h-48 resize-y font-mono text-xs leading-relaxed"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste the full job posting here…"
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={pasteAndExtract}
                  disabled={!pasteText.trim() || extracting}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  {extracting ? "Extracting…" : "Extract & fill missing fields"}
                </button>
                <button
                  onClick={pasteDirect}
                  disabled={!pasteText.trim()}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Just save as posting text
                </button>
                <button
                  onClick={() => { setPasting(false); setPasteText(""); }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
              {extractMsg && <p className="mt-2 text-xs text-emerald-600">{extractMsg}</p>}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            {job.posting_text ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{job.posting_text}</pre>
            ) : (
              <p className="text-sm text-slate-400">No posting text saved. Paste it above or click Edit.</p>
            )}
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {job.notes ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{job.notes}</pre>
          ) : (
            <p className="text-sm text-slate-400">No notes yet. Click Edit to add some.</p>
          )}
        </div>
      )}

      {tab === "submissions" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Upload file
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ""; }} />
            <button
              onClick={() => {
                const text = prompt("Paste submission text:");
                if (text) saveTextSubmission("other", "Pasted text", "txt", text);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Save text
            </button>
          </div>

          {submissions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No submissions yet. Save your resume, cover letter, or application materials here.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {submissions.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.label}</p>
                    <p className="text-xs text-slate-400">
                      {s.type} · {s.format} · {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {s.file_path ? (
                      <a
                        href={`/api/jobs/${job.id}/submissions/${s.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        Download
                      </a>
                    ) : s.content ? (
                      <button
                        onClick={() => {
                          const w = window.open("", "_blank");
                          if (w) { w.document.write(`<pre>${s.content.replace(/</g, "&lt;")}</pre>`); w.document.title = s.label; }
                        }}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        View
                      </button>
                    ) : null}
                    <button
                      onClick={() => deleteSubmission(s.id)}
                      className="text-xs text-rose-400 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="mt-6 flex gap-4 text-xs text-slate-400">
        <span>Added {new Date(job.created_at).toLocaleDateString()}</span>
        {job.applied_at && <span>Applied {new Date(job.applied_at).toLocaleDateString()}</span>}
        {job.match_score != null && <span>Match score: {job.match_score}%</span>}
        <span>Source: {job.source}</span>
      </div>
    </div>
  );
}
