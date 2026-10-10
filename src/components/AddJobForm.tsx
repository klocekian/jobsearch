"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { Banner } from "@astryxdesign/core/Banner";
import { apiSend, errorMessage } from "@/lib/api-client";

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
  const [saveError, setSaveError] = useState("");
  const [fetchStatus, setFetchStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [fetchMsg, setFetchMsg] = useState("");
  const [extractStatus, setExtractStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [extractMsg, setExtractMsg] = useState("");

  const fetchFromUrl = async () => {
    if (!url.trim()) return;
    setFetchStatus("loading");
    setFetchMsg("");
    try {
      const data = await apiSend<{ company?: string; jobTitle?: string; jobDescription?: string }>(
        "/api/fetch-job", "POST", { url: url.trim() },
      );
      if (data.company) setCompany(data.company);
      if (data.jobTitle) setTitle(data.jobTitle);
      if (data.jobDescription) setPostingText(data.jobDescription);
      setFetchStatus("done");
      setFetchMsg("Filled from posting — review and edit as needed.");
    } catch (err: unknown) {
      setFetchStatus("error");
      setFetchMsg(errorMessage(err, "Couldn't fetch. Paste the posting below instead."));
    }
  };

  const extractFromText = async () => {
    if (!postingText.trim()) return;
    setExtractStatus("loading");
    setExtractMsg("");
    try {
      const data = await apiSend<{
        company?: string; jobTitle?: string; location?: string;
        remoteType?: string; salaryText?: string; jobDescription?: string;
      }>("/api/jobs/extract", "POST", { text: postingText.trim(), url: url.trim() || undefined });
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
      setExtractMsg(errorMessage(err, "Extraction failed."));
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const data = await apiSend<{ job: { id: number }; merged?: boolean }>("/api/jobs", "POST", {
        company,
        title,
        url,
        location,
        remote_type: remoteType,
        salary_text: salaryText,
        posting_text: postingText,
        notes,
        source: url ? "url" : "manual",
      });
      router.push(`/jobs/${data.job.id}${data.merged ? "?merged=1" : ""}`);
    } catch (err: unknown) {
      setSaveError(errorMessage(err, "Failed to save."));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button label="Cancel" variant="secondary" onClick={() => router.push("/jobs")} />
        <Button
          label={saving ? "Saving…" : "Save Job"}
          variant="primary"
          onClick={save}
          isDisabled={saving || (!company.trim() && !title.trim())}
        />
      </div>

      {saveError && <Banner status="error" title={saveError} />}

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
          <span className="text-xs font-medium text-secondary">
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

    </div>
  );
}
