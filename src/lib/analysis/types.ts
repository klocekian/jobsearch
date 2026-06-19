// Core data model for the Resume Match & Rewrite Engine.
// Mirrors the entities in the product spec: Resume, Job Description, Match Report.

export type CheckStatus = "pass" | "warning" | "fail";

export interface CheckItem {
  /** Plain-language explanation of the result. */
  message: string;
  status: CheckStatus;
}

export interface SearchabilityGroup {
  label: string;
  items: CheckItem[];
}

export interface SkillRow {
  skill: string;
  /** Occurrences in the resume. */
  resumeCount: number;
  /** Occurrences in the job description. */
  jobCount: number;
  /** matched: present in both. missing: in JD, absent from resume. exceeds: over-indexed. */
  state: "matched" | "missing" | "exceeds";
}

export interface SkillSection {
  matched: number;
  missing: number;
  rows: SkillRow[];
}

export interface RecruiterTip {
  label: string;
  status: CheckStatus;
  message: string;
  evidence?: string[];
}

export interface AiPattern {
  label: string;
  /** 0-100, higher means stronger AI signal. */
  signal: number;
  message: string;
  examples: string[];
}

export interface AiDetection {
  /** 0-100 confidence that text reads as AI-generated. */
  confidence: number;
  /** Human-readable band, since detection is probabilistic. */
  band: "low" | "moderate" | "high";
  patterns: AiPattern[];
}

export interface MatchReport {
  meta: {
    /** Employer name, if provided; used for download filenames. */
    company: string;
    jobTitle: string;
    /** URL of the job posting, if provided; empty otherwise. */
    jobUrl: string;
    /** Source filename when a PDF was uploaded; empty for pasted text. */
    fileName: string;
  };
  /** Overall match score 0-100. */
  score: number;
  counts: {
    hardSkillsIssues: number;
    softSkillsIssues: number;
    searchabilityIssues: number;
    recruiterIssues: number;
  };
  searchability: SearchabilityGroup[];
  hardSkills: SkillSection;
  softSkills: SkillSection;
  recruiterTips: RecruiterTip[];
  aiDetection: AiDetection;
  /** Skill terms tagged for highlighting in the job description view. */
  highlights: { matched: string[]; missing: string[] };
}

export interface AnalyzeInput {
  resumeText: string;
  jobText: string;
  /** Employer name, if provided; used for download filenames. */
  company: string;
  jobTitle: string;
  /** URL of the job posting, if provided; empty otherwise. */
  jobUrl: string;
  /** Source filename when a PDF was uploaded; empty for pasted text. */
  fileName: string;
}
