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

Users normally connect their own AI provider under Profile → AI. The server's own keys
(`ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`, `GEMINI_API_KEY`, `GROK_API_KEY`,
`MISTRAL_API_KEY`) are a fallback billed to whoever runs the server, so in production only the
emails listed in `SERVER_AI_EMAILS` (comma-separated) may use them. Leave it unset locally and
every signed-in user gets the fallback.

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

## MCP server

The job tracker is exposed to MCP clients (Claude, ChatGPT, Claude Code) so an assistant can
read and update the search directly. Tools live in `src/mcp/server.ts`:

| Area | Tools |
| --- | --- |
| Pipeline | `pipeline_summary`, `list_jobs`, `get_job`, `add_job`, `update_job`, `delete_job`, `check_job_status`, `save_submission` |
| Resumes & profile | `list_resumes`, `get_resume`, `create_resume`, `get_candidate_profile`, `update_candidate_doc` |
| Analysis | `run_ats_match`, `run_fitness_check`, `get_fitness_brief`, `save_fitness_report` |

Plus a `fitness_check` prompt. The AI fitness check runs on the client's model rather than
the app's configured provider: `get_fitness_brief` returns the app's exact prompt and output
schema, and `save_fitness_report` validates and stores the result.

### Hosted (`/api/mcp`)

Streamable HTTP, stateless. The URL and setup steps are in **Profile → AI → Connect Claude & ChatGPT**.

- **OAuth 2.1** for connectors: `/.well-known/oauth-protected-resource` →
  `/.well-known/oauth-authorization-server` → `/api/oauth/register` (dynamic registration) →
  `/api/oauth/authorize` (Google sign-in if needed, then a consent page at `/oauth/consent`) →
  `/api/oauth/token` (PKCE S256; access 1h, refresh 30d). Nothing OAuth-related is stored:
  client ids, codes and tokens are HMAC-signed with a key derived from `SESSION_SECRET`.
  Client ids carry their registered redirect URIs, which `/authorize` enforces.
  "Disconnect all connected apps" bumps `users.mcp_oauth_epoch`, which revokes every token
  issued so far.
- **Personal access tokens** (`jbs_pat_…`) for scripts, sent as `Authorization: Bearer`.
  Only a SHA-256 hash is stored (`api_tokens`); the plaintext is shown once.
- `SESSION_SECRET` must stay stable across deploys — rotating it disconnects every client.
  Set `MCP_PUBLIC_ORIGIN` if a proxy hides the public host (issuer and resource URLs must
  match what clients reached).

### Local (stdio)

```bash
pnpm mcp
```

Reads the same database as the app: `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` if set,
otherwise `data/jobsearch.db`. `JOBSEARCH_USER_EMAIL` picks the user (optional when the
database has one); `JOBSEARCH_ENV_FILE` loads those variables from a file. Claude Code picks
up `.mcp.json` in this repo automatically.
