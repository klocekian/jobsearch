# Resume Match Engine

Takes a resume and a job posting and produces a structured analysis of how well the
resume positions the candidate for that specific role, calibrated to the criteria
ATS (Applicant Tracking Systems) use.

This implements the analysis modules of the product spec in
`.context/attachments/.../pasted_text...txt`, and the report UI mirrors the reference
Jobscan Match Reports.

## What it does

Paste a resume and a job description, hit **Analyze**, and get a Match Report with:

- **Searchability (ATS structural)** — contact completeness, summary section, section
  headings, exact job-title match, date formatting, education match, file type/naming.
- **Hard & Soft Skills** — skills extracted from the job description via a curated
  taxonomy + synonym map, reported as `resume count / job-description count` and
  classified matched / missing / over-indexed.
- **Recruiter Tips** — job-level alignment, measurable-results density, tone/cliché
  detection, web presence, word count.
- **AI Authorship Detection** — probabilistic signals (action-verb patterning, lexical
  uniformity, generic quantification, parallel-structure density, specificity deficit)
  reported as a confidence band, never a binary verdict.

Plus two more tabs:

- **Job Description** — the posting with matched skills underlined green, missing skills red.
- **Cover Letter** — generates a cover letter from your resume + the posting using Claude
  (`claude-opus-4-8`). It articulates why you're a match by mapping your real experience to the
  role's requirements, and ties the job to your interests (add an optional note about what draws
  you to the role). The prompt is grounded — it never fabricates experience the resume doesn't
  support. Generation runs server-side via `POST /api/cover-letter`, so the API key never reaches
  the browser.

## Architecture

The analysis engine is pure, deterministic TypeScript with no external API
dependencies — it runs entirely in the browser, so analysis works out of the box.
Only the **Cover Letter** tab calls an LLM, through a server-side route that reads
`ANTHROPIC_API_KEY` from the environment (set it in your shell or `.env.local`).

```
src/lib/analysis/
  types.ts          data model (MatchReport and friends)
  taxonomy.ts       curated skills + synonym/variant map
  text.ts           shared text utilities
  searchability.ts  Module 1: ATS structural analysis
  skills.ts         Module 2: keyword & skills matching
  recruiter.ts      Module 3: recruiter signal analysis
  ai-detection.ts   Module 4: AI authorship detection
  analyze.ts        orchestrator + overall score
  samples.ts        sample resume + JD (pre-loaded)
src/lib/pdf.ts      client-side PDF text extraction (pdfjs)
src/app/api/cover-letter/route.ts   server-side Claude call (cover letter)
src/components/     React UI (report, JD view, cover letter)
```

Each module is an isolated pure function over `{ resumeText, jobText, ... }`, so they
can be tested independently.

## Getting Started

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The form is pre-filled with a
sample resume and job description so you can analyze immediately.
