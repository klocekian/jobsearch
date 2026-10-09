"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { JobRow } from "@/lib/db/jobs";
import { wasSubmitted } from "@/lib/status";
import { TipIcon, type TipIconName } from "@/components/icons";

export interface StrategyBannerItem {
  id: "A" | "B" | "C" | "D";
  icon: TipIconName;
  headline: string;
  body: string;
  full: string;
}

export const STRATEGY_ITEMS: Record<"A" | "B" | "C" | "D", StrategyBannerItem> = {
  A: {
    id: "A",
    icon: "calendar",
    headline: "This is a numbers game.",
    body: "Apply to at least 5 jobs a day. No more. No less. 25 a week.",
    full: "This is a numbers game. Apply to at least 5 jobs a day. No more. No less. 25 a week.",
  },
  B: {
    id: "B",
    icon: "target",
    headline: "Tune your resume till it gets a >90% for a match.",
    body: "Don't submit low score resumes. No one will ever see them.",
    full: "Tune your resume till it gets a >90% for a match. Don't submit low score resumes. No one will ever see them.",
  },
  C: {
    id: "C",
    icon: "dumbbell",
    headline: "Practice first.",
    body: "Apply to jobs you don't love early on. Figure out your resume, your interview approach on them. Then apply to the ones that make you excited.",
    full: "Practice first. Apply to jobs you don't love early on. Figure out your resume, your interview approach on them. Then apply to the ones that make you excited.",
  },
  D: {
    id: "D",
    icon: "filter",
    headline: "Get picky over time.",
    body: "Say yes to any interview or recruiter screen up front. Later, when you are well practiced and have a lay of the land you can be selective.",
    full: "Get picky over time. Say yes to any interview or recruiter screen up front. Later, when you are well practiced and have a lay of the land you can be selective.",
  },
};

interface StrategyBannerProps {
  jobs: JobRow[];
}

export function StrategyBanner({ jobs }: StrategyBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const { appliedCount, has90Match } = useMemo(() => {
    let applied = 0;
    let match90 = false;
    for (const j of jobs) {
      if (wasSubmitted(j)) applied++;
      if ((j.match_score ?? 0) >= 90) match90 = true;
    }
    return { appliedCount: applied, has90Match: match90 };
  }, [jobs]);

  // Rotation rules:
  // 1. Once 90% match is achieved: A, C, D
  // 2. Once past 10 applications: B, C, D
  // 3. When there are few jobs entered or applied to (< 10): A, B
  const activeKeys: ("A" | "B" | "C" | "D")[] = useMemo(() => {
    if (has90Match) {
      return ["A", "C", "D"];
    }
    if (appliedCount >= 10) {
      return ["B", "C", "D"];
    }
    return ["A", "B"];
  }, [has90Match, appliedCount]);

  const activeItems = useMemo(
    () => activeKeys.map((key) => STRATEGY_ITEMS[key]),
    [activeKeys],
  );

  const nextBanner = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % activeItems.length);
  }, [activeItems.length]);

  const prevBanner = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + activeItems.length) % activeItems.length);
  }, [activeItems.length]);

  useEffect(() => {
    if (isPaused || activeItems.length <= 1) return;
    const interval = setInterval(nextBanner, 8000);
    return () => clearInterval(interval);
  }, [isPaused, activeItems.length, nextBanner]);

  if (isDismissed || activeItems.length === 0) return null;

  const currentItem = activeItems[currentIndex % activeItems.length];

  return (
    <div
      role="region"
      aria-label="Job Search Strategy Tips"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-950 dark:text-sky-100 transition-all duration-200"
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-800 dark:text-sky-300 select-none">
          <TipIcon name={currentItem.icon} />
        </span>
        <div className="min-w-0 flex-1 text-sm leading-snug">
          <span className="font-semibold text-primary">{currentItem.headline}</span>{" "}
          <span className="text-secondary">{currentItem.body}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <div className="flex items-center gap-1 mr-1">
          {activeItems.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Go to strategy ${item.id}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex % activeItems.length
                  ? "w-4 bg-sky-800 dark:bg-sky-200"
                  : "w-1.5 bg-sky-600 hover:bg-sky-700 dark:bg-sky-400 dark:hover:bg-sky-300"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={prevBanner}
          aria-label="Previous strategy tip"
          className="p-1 rounded hover:bg-sky-500/15 text-secondary hover:text-primary transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={nextBanner}
          aria-label="Next strategy tip"
          className="p-1 rounded hover:bg-sky-500/15 text-secondary hover:text-primary transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          aria-label="Dismiss strategy banner"
          className="p-1 ml-1 rounded hover:bg-sky-500/15 text-secondary hover:text-primary transition-colors cursor-pointer"
          title="Dismiss"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
