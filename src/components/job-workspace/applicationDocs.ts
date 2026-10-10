import { apiSend } from "@/lib/api-client";
import { coverLetterText, tailoredResumeText } from "@/lib/storage";

/** Submission types for the documents sent with an application. */
export type SubmissionDocType = "resume" | "cover_letter";

/**
 * Saves what was sent for this job as its submissions: the resume tailored
 * for it in Tools (else the picked resume) and the cover letter draft, if one
 * was written. Throws ApiError on failure.
 */
export async function saveApplicationDocs(
  jobId: number,
  picked: { name: string | null; text: string },
): Promise<void> {
  const tailored = tailoredResumeText(jobId);
  const resumeText = tailored || picked.text;
  const letter = coverLetterText(jobId).trim();

  if (resumeText.trim()) {
    await apiSend(`/api/jobs/${jobId}/submissions`, "POST", {
      type: "resume",
      label: tailored ? "Tailored resume" : `Resume — ${picked.name ?? "untitled"}`,
      format: "txt",
      content: resumeText,
    });
  }
  if (letter) {
    await apiSend(`/api/jobs/${jobId}/submissions`, "POST", {
      type: "cover_letter", label: "Cover letter", format: "txt", content: letter,
    });
  }
}
