"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { Banner } from "@astryxdesign/core/Banner";

const remoteOptions = [
  { value: "", label: "—" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

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
        <div className="flex gap-2 items-end">
          <TextInput
            label="Job Posting URL"
            value={url}
            onChange={setUrl}
            placeholder="https://careers.example.com/job/12345"
            className="flex-1"
          />
          <Button
            label={fetchStatus === "loading" ? "Fetching…" : "Fetch"}
            variant="secondary"
            size="md"
            onClick={fetchFromUrl}
            isDisabled={!url.trim() || fetchStatus === "loading"}
          />
        </div>
        {fetchStatus === "done" && <Banner status="success" title={fetchMsg} />}
        {fetchStatus === "error" && <Banner status="error" title={fetchMsg} />}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput label="Company" value={company} onChange={setCompany} placeholder="Google" />
        <TextInput label="Job Title" value={title} onChange={setTitle} placeholder="Director, UX" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput label="Location" value={location} onChange={setLocation} placeholder="San Francisco, CA" />
        <Selector label="Remote" options={remoteOptions} value={remoteType} onChange={setRemoteType} />
        <TextInput label="Salary" value={salaryText} onChange={setSalaryText} placeholder="$150k–$200k" />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">
            Job Description (paste the full posting)
          </span>
          <Button
            label={extractStatus === "loading" ? "Extracting…" : "Extract fields from text"}
            variant="ghost"
            size="sm"
            onClick={extractFromText}
            isDisabled={!postingText.trim() || extractStatus === "loading"}
          />
        </div>
        <TextArea
          label="Job Description"
          isLabelHidden
          value={postingText}
          onChange={setPostingText}
          rows={12}
          placeholder="Paste the full job posting here. Select all the text on the job page, copy it, and paste it here — then click 'Extract fields from text' to auto-fill the fields above."
        />
        {extractStatus === "done" && <Banner status="success" title={extractMsg} />}
        {extractStatus === "error" && <Banner status="error" title={extractMsg} />}
      </div>

      <TextArea
        label="Notes (optional)"
        value={notes}
        onChange={setNotes}
        rows={3}
        placeholder="Any notes — who referred you, why you're interested, etc."
      />

      <div className="flex gap-3">
        <Button
          label={saving ? "Saving…" : "Save Job"}
          variant="primary"
          onClick={save}
          isDisabled={saving || (!company.trim() && !title.trim())}
        />
        <Button
          label="Cancel"
          variant="secondary"
          onClick={() => router.push("/jobs")}
        />
      </div>
    </div>
  );
}
