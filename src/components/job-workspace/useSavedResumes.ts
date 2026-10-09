import { useEffect, useRef, useState } from "react";
import { useResumes } from "@/hooks/useResumes";
import type { JobRow } from "@/lib/db/jobs";

/**
 * The user's saved resumes plus the text of the one picked for this job.
 * Starts on the default resume, then switches to the one the stored match
 * score was run against, so the saved report and the resume beside it agree.
 */
export function useSavedResumes(job: JobRow | null) {
  const { resumes: savedResumes, setResumes: setSavedResumes, loading } = useResumes();
  const [resumeText, setResumeText] = useState("");

  // Once the resumes load, start on the default one (unless a resume is already picked).
  const defaultPicked = useRef(false);
  useEffect(() => {
    if (defaultPicked.current || loading) return;
    defaultPicked.current = true;
    if (savedResumes.length === 0) return;
    const def = savedResumes.find(r => r.is_default) ?? savedResumes[0];
    setResumeText((t) => t || def.content); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loading, savedResumes]);

  const resumePicked = useRef(false);
  useEffect(() => {
    if (resumePicked.current || !job || savedResumes.length === 0) return;
    resumePicked.current = true;
    const match = job.match_resume_name ? savedResumes.find((r) => r.name === job.match_resume_name) : undefined;
    if (match) setResumeText(match.content); // eslint-disable-line react-hooks/set-state-in-effect
  }, [job, savedResumes]);

  return { savedResumes, setSavedResumes, resumeText, setResumeText };
}
