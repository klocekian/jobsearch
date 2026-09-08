# Fitness Check

A 1–10 score for **whether a job posting is worth pursuing**, scored against a
stored profile of the candidate rather than keyword overlap.

## Why this is separate from the ATS Match score

They answer different questions.

| | Measures | Answers |
|---|---|---|
| **ATS Match** | the resume | Will this document survive a keyword screen? |
| **Fitness** | the pursuit | Is this role clearable, and what does chasing it cost? |

Keyword similarity is highest exactly when a posting uses your own vocabulary,
which is often when it is least informative. A posting can score 89% on
keywords while stating a ten-year requirement in a discipline you have never
touched. Both numbers are kept, because both are useful — for different things.

## Setup

The check is grounded in two documents, managed in the app at
**Profile → Candidate Profile**.

### 1. Positive profile — the fact canon

What can be claimed **directly**: verified figures, ownership scope, role
history, technologies actually held. Written plainly, one fact per line. This
is the only source the check may draw claims from.

### 2. Negative profile — gaps, and how to talk about them

What you do **not** have. This is the part no commercial tool has, and it is
why they cannot produce a MISS. Two sections:

- **Hard gaps** — never touched, nothing adjacent. A stated requirement
  matching one of these triggers a hard stop.
- **Reframable gaps** — real related experience exists, each paired with a
  standing reframe. These become ADJACENT rather than MISS, and the reframe is
  carried into the report as interview preparation.

**Both documents are required.** `POST /api/fitness-check` returns 409 naming
what is missing rather than scoring against half a profile — without the
negative profile it degrades into a similarity scorer, which is the instrument
it exists to replace.

Documents are stored per user, so yours are your own.

### Loading them from files

Instead of pasting, seed from local markdown:

```bash
node scripts/seed-candidate-docs.mjs \
  --profile path/to/profile.md \
  --gaps    path/to/gaps.md \
  [--email you@example.com]
```

Log in to the app first so the documents attach to your account. Re-running
overwrites, so this doubles as a re-sync. After seeding, the app is the source
of truth — edit in the app, not the files.

### Claude connection

Uses the app's existing resolution: your per-user token
(**Profile → Connect Claude**) first, then a global env key. Runs on Opus.

## Using it

Open a job, choose the **Fitness** tab, press **Run fitness check**. The
posting text is what gets scored — not your resume.

The report saves automatically when it completes, so the score appears on the
jobs list and survives navigation. Re-running overwrites, which is what you
want when checking against a revised posting.

Two actions stay behind explicit buttons, because they change the job rather
than record a result:

- **Add to notes** — prepends the full report above existing notes.
- **Add to notes and abandon** — the same, plus sets status to abandoned.
  Offered only on a `DO_NOT_PURSUE` verdict.

## Reading the report

Every requirement is quoted **verbatim** next to its verdict. That is
deliberate: it makes the whole report auditable in about fifteen seconds.
Paraphrase is where softening happens, and a tool you cannot check is a tool
that drifts.

- **MEET** — the positive profile supports it directly.
- **ADJACENT** — real related experience exists; a standing reframe applies.
- **MISS** — a hard gap, or genuinely never touched.

Only **objective** minimums affect the score. Dispositional items ("excellent
communicator", "thrives in ambiguity") are reported as interview material and
never lower it. Preferred qualifications inform the score modestly.

**Two hard stops** produce `DO_NOT_PURSUE` regardless of score: a stated
required item that is a hard gap, and travel above roughly 25%.

The report also carries preparation material — each gap paired with a framing,
an outcome spectrum, and the tradeoffs of pursuing.

## Schema

`candidate_docs`, plus `fitness_score` / `fitness_report` / `fitness_run_at` /
`match_resume_name` on `jobs`. Created by `getDb()` on first run, following the
existing `CREATE TABLE IF NOT EXISTS` and best-effort `ALTER TABLE` pattern.
No migration step.

## Troubleshooting

| Symptom | Cause |
|---|---|
| 409, "needs your positive/negative profile" | One or both documents are empty. Profile → Candidate Profile. |
| "This job has no posting text to check" | The job row has no `posting_text`. Paste or re-clip the posting. |
| "hit the token ceiling and the result was cut off" | Posting plus profiles exceeded the output budget. Trim the posting, or shorten the profile documents. |
| "Anthropic auth failed" | Reconnect Claude on the Profile page. |
