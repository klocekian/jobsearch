import { apiSend } from "@/lib/api-client";
import { buildPackageMarkdown } from "@/lib/package";
import { coverLetterText, loadSavedResume } from "@/lib/storage";
import type { JobRow } from "@/lib/db/jobs";

/**
 * Saves the application package (edited resume, posting, cover letter) as a
 * Markdown submission on the job. `resumeFallbackText` is used when no
 * structured resume has been saved. Throws ApiError on failure.
 */
export function saveApplicationPackage(job: JobRow, resumeFallbackText: string): Promise<unknown> {
  const md = buildPackageMarkdown({
    company: job.company, jobTitle: job.title, jobUrl: job.url,
    jobText: job.posting_text, resume: loadSavedResume(), resumeFallbackText,
    coverLetter: coverLetterText(),
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  });
  return apiSend(`/api/jobs/${job.id}/submissions`, "POST", {
    type: "package", label: `Application Package — ${new Date().toLocaleDateString()}`, format: "md", content: md,
  });
}
