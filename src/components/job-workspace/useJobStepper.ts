"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { loadJobListIds, loadJobListSortKey, loadJobListSortOrder, loadJobListStatus, saveJobListIds } from "@/lib/storage";

/**
 * Previous/next through the job list the user last looked at (its order and
 * filter), with k/j and Alt+↑/↓ as shortcuts.
 */
export function useJobStepper(jobId: number) {
  const router = useRouter();
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    const load = async () => {
      const stored = loadJobListIds();
      if (stored.length > 0) { setIds(stored); return; }
      const params = new URLSearchParams({ sort: loadJobListSortKey(), order: loadJobListSortOrder() });
      const status = loadJobListStatus();
      if (status) params.set("status", status);
      try {
        const list = ((await apiGet<{ jobs?: { id: number }[] }>(`/api/jobs?${params}`)).jobs || []).map((j) => j.id);
        setIds(list);
        saveJobListIds(list);
      } catch {}
    };
    load();
  }, []);

  const index = ids.indexOf(jobId);
  const prevId = index > 0 ? ids[index - 1] : null;
  const nextId = index >= 0 && index < ids.length - 1 ? ids[index + 1] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) return;
      const target = e.key === "k" || (e.key === "ArrowUp" && e.altKey) ? prevId : e.key === "j" || (e.key === "ArrowDown" && e.altKey) ? nextId : null;
      if (target) { e.preventDefault(); router.push(`/jobs/${target}`); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevId, nextId, router]);

  return { index, total: ids.length, prevId, nextId, go: (id: number | null) => id && router.push(`/jobs/${id}`) };
}
