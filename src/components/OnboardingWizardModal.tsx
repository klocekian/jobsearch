"use client";

import { useEffect, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/Stack";

interface OnboardingStep {
  badge: string;
  title: string;
  subtitle: string;
  content: React.ReactNode;
}

const STEPS: OnboardingStep[] = [
  {
    badge: "Overview",
    title: "Welcome to Job Search",
    subtitle: "A structured, AI-powered system for qualification, targeted tailoring, and tracking.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-secondary leading-relaxed">
          Job Search isn&apos;t just a simple tracking spreadsheet — it is an end-to-end qualification and tailoring engine. It helps you prioritize high-fit roles, prepare honest interview narratives, tailor materials, and manage your pipeline without keyword fluff.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2">
          <div className="p-3 rounded-lg border border-border bg-subtle space-y-1">
            <span className="text-xs font-bold text-primary block">1. Capture</span>
            <p className="text-xs text-secondary">Clip postings via the Chrome Extension or import sheets.</p>
          </div>
          <div className="p-3 rounded-lg border border-border bg-subtle space-y-1">
            <span className="text-xs font-bold text-primary block">2. Qualify</span>
            <p className="text-xs text-secondary">Score candidate profile fitness (1–10) against job minimums.</p>
          </div>
          <div className="p-3 rounded-lg border border-border bg-subtle space-y-1">
            <span className="text-xs font-bold text-primary block">3. Tailor</span>
            <p className="text-xs text-secondary">Run ATS pass score & rewrite resumes targeting missing skills.</p>
          </div>
          <div className="p-3 rounded-lg border border-border bg-subtle space-y-1">
            <span className="text-xs font-bold text-primary block">4. Track</span>
            <p className="text-xs text-secondary">Advance stages, log interview notes, and inspect the funnel.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    badge: "Step 1 of 5",
    title: "Adding Jobs & The Chrome Extension",
    subtitle: "Easily collect job postings from any hiring site or bulk import existing spreadsheets.",
    content: (
      <div className="space-y-3">
        <div className="space-y-2.5">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-subtle">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs">
              ⚡
            </div>
            <div>
              <Text weight="semibold" display="block">Chrome Side-Panel Extension</Text>
              <Text type="supporting" color="secondary" className="mt-0.5">
                The fastest way to add jobs. Clip job details with 1 click directly from LinkedIn, Greenhouse, Lever, Ashby, or Workday without leaving the page.
              </Text>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-subtle">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 font-bold text-xs">
              📊
            </div>
            <div>
              <Text weight="semibold" display="block">Google Sheet & CSV Import</Text>
              <Text type="supporting" color="secondary" className="mt-0.5">
                Already tracking jobs in a Google Sheet? Use <strong>&quot;Import from Google Sheet&quot;</strong> in the header to sync your list in bulk.
              </Text>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-subtle">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 font-bold text-xs">
              ✍️
            </div>
            <div>
              <Text weight="semibold" display="block">Manual Entry</Text>
              <Text type="supporting" color="secondary" className="mt-0.5">
                Click <strong>&quot;Add Job&quot;</strong> in the header to paste in any job title, company, salary band, and raw description.
              </Text>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    badge: "Step 2 of 5",
    title: "Candidate Profile vs. Resumes",
    subtitle: "Why we separate your canonical truth from individual presentation documents.",
    content: (
      <div className="space-y-3.5">
        <p className="text-sm text-secondary leading-relaxed">
          Standard tools treat resumes as the only source of truth. Here, your <strong>Candidate Profile</strong> acts as your factual canon:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Badge variant="success" label="Positive Profile" />
              <span className="text-xs font-semibold text-primary">Fact Canon</span>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              Every verified technology, leadership scope, figure, and achievement you have actually held. Prevents AI from inventing unsubstantiated claims.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Badge variant="error" label="Negative Profile" />
              <span className="text-xs font-semibold text-primary">Gaps & Reframes</span>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              Hard stops (e.g. &gt;25% travel) and standing reframes for adjacent skills. This enables the engine to give honest verdicts rather than false-positive matches.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    badge: "Step 3 of 5",
    title: "Profile Fitness Scoring",
    subtitle: "Objective 1–10 fit scoring against literal posting requirements.",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-secondary leading-relaxed">
          The <strong>Profile Fitness Check</strong> reads the job posting and evaluates each stated qualification against your profile:
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-2.5 p-2 rounded-md border border-border bg-subtle">
            <Badge variant="success" label="MEET" />
            <p className="text-xs text-secondary">Directly supported by your fact canon.</p>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-md border border-border bg-subtle">
            <Badge variant="warning" label="ADJACENT" />
            <p className="text-xs text-secondary">Transferable experience; provides a prepared interview talking point.</p>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-md border border-border bg-subtle">
            <Badge variant="error" label="MISS" />
            <p className="text-xs text-secondary">Hard gap or untouched discipline — sets an honest preparation boundary.</p>
          </div>
        </div>

        <p className="text-xs text-secondary italic">
          💡 Run instantly with deterministic matching, or check <strong>&quot;with AI&quot;</strong> for deep LLM reasoning.
        </p>
      </div>
    ),
  },
  {
    badge: "Step 4 of 5",
    title: "Resume Scoring & AI Rewrites",
    subtitle: "ATS keyword pass scoring, multiple resumes, and tailored writing.",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-secondary leading-relaxed">
          Under the <strong>Resume tab</strong> in any job:
        </p>

        <div className="space-y-2.5">
          <div className="p-2.5 rounded-lg border border-border bg-subtle space-y-1">
            <span className="text-xs font-semibold text-primary block">Multiple Resumes</span>
            <p className="text-xs text-secondary">
              Upload multiple resumes (e.g. IC, Tech Lead, Design Manager). Pick the best resume variant for each job from the dropdown.
            </p>
          </div>

          <div className="p-2.5 rounded-lg border border-border bg-subtle space-y-1">
            <span className="text-xs font-semibold text-primary block">ATS Pass (0–100) & AI Slop Check</span>
            <p className="text-xs text-secondary">
              Identifies matched vs. missing skills, hard requirements, and warns if your text sounds like generic AI filler.
            </p>
          </div>

          <div className="p-2.5 rounded-lg border border-border bg-subtle space-y-1">
            <span className="text-xs font-semibold text-primary block">AI Rewrite & PDF Download</span>
            <p className="text-xs text-secondary">
              Click <strong>&quot;Edit&quot;</strong> → <strong>&quot;Generate rewrite&quot;</strong> to target missing keywords directly, then download an ATS-compliant PDF.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    badge: "Step 5 of 5",
    title: "Applying, Status Tracking & Notes",
    subtitle: "Manage your active pipeline from initial submission to offer.",
    content: (
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="p-2 rounded border border-border bg-subtle text-center">
            <span className="text-xs font-bold text-primary block">Saved</span>
            <span className="text-[11px] text-secondary">Queued to review</span>
          </div>
          <div className="p-2 rounded border border-blue-500/20 bg-blue-500/5 text-center">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block">Applied</span>
            <span className="text-[11px] text-secondary">Submitted application</span>
          </div>
          <div className="p-2 rounded border border-purple-500/20 bg-purple-500/5 text-center">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block">Screen</span>
            <span className="text-[11px] text-secondary">Recruiter chat</span>
          </div>
          <div className="p-2 rounded border border-amber-500/20 bg-amber-500/5 text-center">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">Interview</span>
            <span className="text-[11px] text-secondary">Technical / Panel</span>
          </div>
          <div className="p-2 rounded border border-emerald-500/20 bg-emerald-500/5 text-center">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">Offer</span>
            <span className="text-[11px] text-secondary">Offer extended</span>
          </div>
          <div className="p-2 rounded border border-rose-500/20 bg-rose-500/5 text-center">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block">Closed</span>
            <span className="text-[11px] text-secondary">Declined or filled</span>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-subtle space-y-1">
          <Text weight="semibold" display="block">Notes & Interview Insights</Text>
          <Text type="supporting" color="secondary">
            Use the <strong>&quot;Add to notes&quot;</strong> button or the Notes box on any job to save salary discussions, interview questions, and follow-ups.
          </Text>
        </div>
      </div>
    ),
  },
];

const ONBOARDING_STORAGE_KEY = "has_completed_onboarding_wizard_v1";

export function OnboardingWizardModal() {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem(ONBOARDING_STORAGE_KEY);
    }
    return false;
  });
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const openHandler = () => {
      setStepIndex(0);
      setIsOpen(true);
    };

    window.addEventListener("open-onboarding-wizard", openHandler);
    return () => window.removeEventListener("open-onboarding-wizard", openHandler);
  }, []);

  const close = () => {
    setIsOpen(false);
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch {}
  };

  const next = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      close();
    }
  };

  const prev = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!isOpen) return null;

  const current = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/40">
          <div className="flex items-center gap-2">
            <Badge variant="neutral" label={current.badge} />
            <span className="text-xs text-secondary font-medium">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
          </div>
          <button
            onClick={close}
            className="text-secondary hover:text-primary transition-colors p-1 rounded-md text-sm font-medium"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-4 flex-1">
          <div>
            <Heading level={2} className="tracking-tight text-xl font-bold">
              {current.title}
            </Heading>
            <p className="text-sm text-secondary mt-1">
              {current.subtitle}
            </p>
          </div>

          <div className="pt-2">
            {current.content}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/20">
          {/* Step dots indicator */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setStepIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === stepIndex
                    ? "w-6 bg-primary"
                    : "w-2 bg-border hover:bg-secondary"
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <HStack gap={2} className="items-center">
            {stepIndex > 0 ? (
              <Button
                label="Back"
                variant="secondary"
                size="sm"
                onClick={prev}
              />
            ) : (
              <Button
                label="Skip tour"
                variant="ghost"
                size="sm"
                onClick={close}
              />
            )}

            <Button
              label={isLast ? "Get Started" : "Next →"}
              variant="primary"
              size="sm"
              onClick={next}
            />
          </HStack>
        </div>
      </div>
    </div>
  );
}
