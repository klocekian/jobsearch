"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import type { SubmissionRow } from "@/lib/db/submissions";
import { STATUS_OPTIONS, STATUS_COLORS } from "@/lib/status";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { Card } from "@astryxdesign/core/Card";
import { Spinner } from "@astryxdesign/core/Spinner";

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

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
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

      <div className="mb-6 flex flex-wrap gap-2">
        <Button label="Analyze Match" variant="primary" href={`/?jobId=${job.id}`} />
        <Button label="Edit" variant="secondary" onClick={startEdit} />
        <Button label="Delete" variant="destructive" onClick={deleteJob} />
      </div>

      {/* Edit modal */}
      {editing && (
        <Card className="mb-6 p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Edit Job</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Company" value={editCompany} onChange={setEditCompany} />
              <TextInput label="Title" value={editTitle} onChange={setEditTitle} />
            </div>
            <TextInput label="URL" value={editUrl} onChange={setEditUrl} />
            <div className="grid grid-cols-3 gap-3">
              <TextInput label="Location" value={editLocation} onChange={setEditLocation} />
              <Selector
                label="Remote"
                options={[
                  { value: "", label: "—" },
                  { value: "remote", label: "Remote" },
                  { value: "hybrid", label: "Hybrid" },
                  { value: "onsite", label: "On-site" },
                ]}
                value={editRemoteType}
                onChange={setEditRemoteType}
              />
              <TextInput label="Salary" value={editSalaryText} onChange={setEditSalaryText} />
            </div>
            <TextArea label="Job Posting Text" value={editPostingText} onChange={setEditPostingText} rows={12} />
            <TextArea label="Notes" value={editNotes} onChange={setEditNotes} rows={3} />
            <div className="flex gap-2">
              <Button label="Save" variant="primary" onClick={saveEdit} />
              <Button label="Cancel" variant="secondary" onClick={() => setEditing(false)} />
            </div>
          </div>
        </Card>
      )}

      <div className="mb-4">
        <TabList value={tab} onChange={(v) => setTab(v as Tab)}>
          <Tab value="posting" label="Job Posting" />
          <Tab value="submissions" label={`Submissions (${submissions.length})`} />
          <Tab value="notes" label="Notes" />
        </TabList>
      </div>

      {/* Tab content */}
      {tab === "posting" && (
        <div className="space-y-3">
          {!pasting && (
            <div className="flex items-center gap-2">
              <Button
                label={job.posting_text ? "Paste updated posting" : "Paste job posting"}
                variant="secondary"
                size="sm"
                onClick={() => setPasting(true)}
              />
              {extractMsg && <span className="text-xs text-emerald-600">{extractMsg}</span>}
            </div>
          )}

          {pasting && (
            <Card className="p-4">
              <p className="mb-2 text-xs text-slate-500">
                Select all text on the job posting page, copy it, and paste it here.
              </p>
              <TextArea
                label="Paste posting"
                isLabelHidden
                value={pasteText}
                onChange={setPasteText}
                placeholder="Paste the full job posting here…"
                rows={12}
              />
              <div className="mt-2 flex gap-2">
                <Button
                  label={extracting ? "Extracting…" : "Extract & fill missing fields"}
                  variant="primary"
                  onClick={pasteAndExtract}
                  isDisabled={!pasteText.trim() || extracting}
                />
                <Button
                  label="Just save as posting text"
                  variant="secondary"
                  onClick={pasteDirect}
                  isDisabled={!pasteText.trim()}
                />
                <Button
                  label="Cancel"
                  variant="secondary"
                  onClick={() => { setPasting(false); setPasteText(""); }}
                />
              </div>
              {extractMsg && <p className="mt-2 text-xs text-emerald-600">{extractMsg}</p>}
            </Card>
          )}

          <Card className="p-5">
            {job.posting_text ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{job.posting_text}</pre>
            ) : (
              <p className="text-sm text-slate-400">No posting text saved. Paste it above or click Edit.</p>
            )}
          </Card>
        </div>
      )}

      {tab === "notes" && (
        <Card className="p-5">
          {job.notes ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{job.notes}</pre>
          ) : (
            <p className="text-sm text-slate-400">No notes yet. Click Edit to add some.</p>
          )}
        </Card>
      )}

      {tab === "submissions" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              label="Upload file"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            />
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ""; }} />
            <Button
              label="Save text"
              variant="secondary"
              size="sm"
              onClick={() => {
                const text = prompt("Paste submission text:");
                if (text) saveTextSubmission("other", "Pasted text", "txt", text);
              }}
            />
          </div>

          {submissions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No submissions yet. Save your resume, cover letter, or application materials here.
            </p>
          ) : (
            <Card className="divide-y divide-slate-100">
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
                      <Button
                        label="View"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const w = window.open("", "_blank");
                          if (w) { w.document.write(`<pre>${s.content.replace(/</g, "&lt;")}</pre>`); w.document.title = s.label; }
                        }}
                      />
                    ) : null}
                    <Button
                      label="Remove"
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteSubmission(s.id)}
                    />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="mt-6 flex gap-4 text-xs text-slate-400">
        <span>Added {new Date(job.created_at).toLocaleDateString()}</span>
        {job.applied_at && <span>Applied {new Date(job.applied_at).toLocaleDateString()}</span>}
        {job.fitness_score != null && <span>Fitness: {job.fitness_score}/10</span>}
        {job.match_score != null && (
          <span>
            ATS match: {job.match_score}%
            {job.match_resume_name ? ` · ${job.match_resume_name}` : ""}
          </span>
        )}
        <span>Source: {job.source}</span>
      </div>
    </div>
  );
}
