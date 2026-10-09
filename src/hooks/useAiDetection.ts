import { useEffect, useMemo, useState } from "react";
import { apiSend } from "@/lib/api-client";
import { loadAiDetection, saveAiDetection } from "@/lib/storage";
import type { AiDetection, MatchReport } from "@/lib/analysis/types";
import type { AiDetectionState } from "@/components/MatchReportView";

/**
 * AI-authorship detection for the analyzed resume: the cached result if
 * present, otherwise /api/ai-detection, falling back to the heuristic
 * detection already in the match report until (or unless) that answers.
 */
export function useAiDetection(analyzed: { report: MatchReport; resumeText: string } | null): AiDetectionState {
  const [asyncAiDetection, setAsyncAiDetection] = useState<{ text: string; data: AiDetection } | null>(null);

  const aiDetection = useMemo<AiDetectionState>(() => {
    if (!analyzed) return { status: "loading", data: null };
    const text = analyzed.resumeText;
    if (asyncAiDetection && asyncAiDetection.text === text) {
      return { status: "done", data: asyncAiDetection.data };
    }
    const cached = typeof window !== "undefined" ? loadAiDetection(text) : null;
    if (cached) return { status: "done", data: cached };
    return { status: "done", data: analyzed.report.aiDetection };
  }, [analyzed, asyncAiDetection]);

  useEffect(() => {
    if (!analyzed) return;
    const text = analyzed.resumeText;
    const cached = typeof window !== "undefined" ? loadAiDetection(text) : null;
    if (cached) return;

    let active = true;
    apiSend<{ confidence?: number; band?: string; patterns?: unknown }>("/api/ai-detection", "POST", { resumeText: text })
      .then((d) => {
        if (!active) return;
        if (d && typeof d.confidence === "number" && Array.isArray(d.patterns)) {
          const det = d as unknown as AiDetection;
          saveAiDetection(text, det);
          setAsyncAiDetection({ text, data: det });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [analyzed]);

  return aiDetection;
}
