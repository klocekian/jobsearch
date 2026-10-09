import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import type { ResumeRow } from "@/lib/db/resumes";

/** The signed-in user's saved resumes, default first. */
export function useResumes() {
  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    apiGet<{ resumes?: ResumeRow[] }>("/api/resumes")
      .then((data) => {
        if (!ignore && data.resumes) setResumes(data.resumes);
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  /** Reload the list. Throws ApiError on failure. */
  const refetch = useCallback(async () => {
    const data = await apiGet<{ resumes?: ResumeRow[] }>("/api/resumes");
    setResumes(data.resumes ?? []);
  }, []);

  return { resumes, setResumes, loading, refetch };
}
