"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { JobRow } from "@/lib/db/jobs";
import { apiSend, errorMessage } from "@/lib/api-client";
import { formatDate, formatSalary } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { applicationGroup, isExploring, type SearchPhase, type ApplicationGroup } from "@/lib/search-workflow";
import { saveJobListIds } from "@/lib/storage";
import { PrepareSpace } from "./PrepareSpace";
import styles from "./search.module.css";

const copy = {
  explore: { eyebrow: "01 / FIND YOUR DIRECTION", title: "Good work starts with curiosity.", description: "Collect roles that interest you. Look for patterns. Give yourself room to discover what comes next." },
  prepare: { eyebrow: "02 / BUILD YOUR STORY", title: "Get better with every iteration.", description: "Turn what you’re seeing and hearing into stronger materials, clearer direction, and skills worth building." },
  applications: { eyebrow: "03 / KEEP THINGS MOVING", title: "Make room for the next conversation.", description: "Prepare thoughtfully, keep track of what you sent, and bring what you learn back into your search." },
};

export function SearchHome({ jobs, phase, onJobChange, error, retry, initialFilter }: { jobs: JobRow[] | null; phase: SearchPhase; onJobChange: (job: JobRow) => void; error: string | null; retry: () => void; initialFilter: string | null }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(initialFilter === "shortlist" && phase === "explore" ? "shortlist" : "all");
  const [sort, setSort] = useState("recent");
  const [pending, setPending] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const all = jobs ?? [];
  const exploring = all.filter(isExploring);
  const conversations = all.filter((j) => applicationGroup(j) === "conversation");
  const applicationJobs = all.filter((j) => applicationGroup(j) !== null);
  const shortlist = exploring.filter((j) => j.is_starred);
  const visible = useMemo(() => {
    let list = (jobs ?? []).filter(phase === "applications" ? (j) => applicationGroup(j) !== null : isExploring);
    if (filter === "shortlist") list = list.filter((j) => j.is_starred);
    if (filter === "preparing") list = list.filter((j) => j.status === "applying");
    if (filter === "active") list = list.filter((j) => applicationGroup(j) !== "finished");
    const text = query.trim().toLowerCase();
    list = list.filter((j) => `${j.company} ${j.title} ${j.location}`.toLowerCase().includes(text));
    return list.sort(sort === "fit" ? (a, b) => (b.fitness_score ?? -1) - (a.fitness_score ?? -1) : (a, b) => b.created_at.localeCompare(a.created_at));
  }, [jobs, phase, filter, query, sort]);

  useEffect(() => { if (phase !== "prepare") saveJobListIds(visible.map((j) => j.id)); }, [visible, phase]);

  async function toggleShortlist(job: JobRow) {
    setPending(job.id); setActionError("");
    try {
      const result = await apiSend<{ job: JobRow }>(`/api/jobs/${job.id}`, "PATCH", { is_starred: job.is_starred ? 0 : 1 });
      onJobChange(result.job);
    } catch (err) { setActionError(errorMessage(err, "Could not update your shortlist. Try again.")); }
    finally { setPending(null); }
  }

  const content = copy[phase];
  return <main className={styles.page}>
    <div className={styles.pageInner}>
      <div className={styles.breadcrumb}>YOUR JOB SEARCH <span>/</span> A work in progress, by design</div>
      <section className={styles.hero}>
        <div><p className={styles.eyebrow}>{content.eyebrow}</p><h1>{content.title}</h1><p className={styles.intro}>{content.description}</p></div>
        <div className={styles.cycle} aria-label="Explore, prepare, apply, learn, repeat"><span>Explore</span><span>Prepare</span><span>Apply</span><span className={styles.cycleReturn}>↶ Learn & repeat</span></div>
      </section>

      <div className={styles.metrics}>
        <Link href="/jobs?phase=explore"><span>Room to explore</span><strong>{jobs ? exploring.length : "—"}</strong><small>roles on your radar</small></Link>
        <Link href="/jobs?phase=explore&filter=shortlist"><span>Worth a closer look</span><strong>{jobs ? shortlist.length : "—"}</strong><small>shortlisted opportunities</small></Link>
        <Link href="/jobs?phase=applications"><span>Out in the world</span><strong>{jobs ? applicationJobs.filter((j) => applicationGroup(j) === "waiting").length : "—"}</strong><small>applications awaiting a response</small></Link>
        <Link href="/jobs?phase=applications"><span>Conversations started</span><strong>{jobs ? conversations.length : "—"}</strong><small>recruiter, interview & offer stages</small></Link>
      </div>

      {error && <div className={styles.error} role="alert">{error} <button onClick={retry}>Try again</button></div>}
      {actionError && <p className={styles.error} role="alert">{actionError}</p>}

      {phase === "prepare" ? <PrepareSpace jobs={all} /> : <div className={styles.layout}>
        <section className={styles.primarySection} aria-label={phase === "explore" ? "Opportunities" : "Applications"}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{phase === "explore" ? "THE POSSIBILITIES" : "YOUR PIPELINE"}</p><h2>{phase === "explore" ? "On your radar" : "One next step at a time"}</h2></div><Link className={styles.button} href="/jobs?add=1">+ Save a job</Link></div>
          <div className={styles.toolbar}>
            <div className={styles.filters} aria-label="Filter jobs">
              {(phase === "explore" ? [{ id: "all", label: "All opportunities" }, { id: "shortlist", label: "Shortlisted" }, { id: "preparing", label: "Preparing" }] : [{ id: "all", label: "All applications" }, { id: "active", label: "Active" }, { id: "preparing", label: "Preparing" }]).map((f) => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
            </div>
            <div className={styles.searchControls}><input aria-label="Search jobs" placeholder="Search roles or companies…" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Sort opportunities" value={sort} onChange={(e) => setSort(e.target.value)}><option value="recent">Newest first</option><option value="fit">Highest fit</option></select></div>
          </div>
          {!jobs && !error && <p className={styles.empty} role="status">Loading your search…</p>}
          {jobs && !visible.length && <div className={styles.empty}><span className={styles.emptySymbol} aria-hidden="true">↗</span><h3>{query || filter !== "all" ? "No roles match this view" : phase === "explore" ? "Start with a little curiosity" : "Your next chapter is taking shape"}</h3><p>{query || filter !== "all" ? "Try a different search or filter." : phase === "explore" ? "Save a job that catches your eye. You don’t need to be ready to apply." : "When you start preparing an application or record a submission, it will appear here."}</p><Link className={styles.textLink} href={phase === "explore" ? "/jobs?add=1" : "/jobs?phase=explore"}>{phase === "explore" ? "Save your first role" : "Explore opportunities"} <span>↗</span></Link></div>}
          {phase === "explore" ? <div className={styles.jobGrid}>{visible.map((job) => <JobCard key={job.id} job={job} pending={pending !== null} onStar={() => toggleShortlist(job)} />)}</div> : <ApplicationList jobs={visible} />}
          <div className={styles.listFooter}><span>{visible.length} {phase === "explore" ? "opportunities" : "applications"}{query ? " matching your search" : " in this view"}</span><Link href="/jobs?view=tracker">Full tracker, imports & archive ↗</Link></div>
        </section>
        <aside className={styles.sidebar}>
          <div className={styles.nextCard}><p className={styles.eyebrow}>{phase === "explore" ? "MAKE THE CONNECTION" : "CLOSE THE LOOP"}</p><span className={styles.bigArrow} aria-hidden="true">↗</span><h2>{phase === "explore" ? "Let the market shape your next draft." : "Every conversation can teach you something."}</h2><p>{phase === "explore" ? "Notice the skills and experiences that come up again. Use those patterns to strengthen your resume and choose what to learn." : "Capture real feedback, questions you weren’t ready for, and stories that landed. Bring them into your next round of preparation."}</p><Link className={styles.lightButton} href={phase === "explore" ? "/jobs?phase=prepare" : "/jobs?phase=prepare#learning"}>{phase === "explore" ? "Go to your preparation space" : "Reflect & improve"} <span>→</span></Link></div>
          <div className={styles.asideNote}><p className={styles.eyebrow}>A SEARCH, NOT A STRAIGHT LINE</p><h3>You can be in more than one phase.</h3><p>Keep exploring while you apply. Keep improving while you wait. Your next step doesn’t have to look like your last one.</p></div>
          {all.some((j) => j.auto_closed) && <Link className={styles.noticeLink} href="/jobs?view=tracker">Some postings may have closed. Review the posting checks →</Link>}
        </aside>
      </div>}
      <footer className={styles.footer}><span>fieldlines <span> / </span> Make your next move a thoughtful one.</span><Link href="/profile?tab=extension">Capture jobs with the extension ↗</Link></footer>
    </div>
  </main>;
}

function JobCard({ job, onStar, pending }: { job: JobRow; onStar: () => void; pending: boolean }) {
  return <article className={styles.jobCard}>
    <div className={styles.cardTop}><span className={styles.companyLogo} aria-hidden="true">{(job.company || "?").slice(0, 2).toUpperCase()}</span><span className={styles.company}>{job.company || "Company not added"}</span><button className={styles.star} aria-label={`${job.is_starred ? "Remove" : "Add"} ${job.company} ${job.title} ${job.is_starred ? "from" : "to"} shortlist`} aria-pressed={!!job.is_starred} onClick={onStar} disabled={pending}>{job.is_starred ? "★" : "☆"}</button></div>
    <Link className={styles.jobTitle} href={`/jobs/${job.id}`}>{job.title || "Untitled role"}<span aria-hidden="true">↗</span></Link>
    <p className={styles.meta}>{[job.location, job.remote_type && job.remote_type !== "unknown" ? job.remote_type : null].filter(Boolean).join(" · ") || "Location not specified"}</p>
    <p className={styles.salary}>{formatSalary(job) || "Salary not listed"}</p>
    <div className={styles.cardTags}><span className={styles.tag}>{job.status === "applying" ? "Preparing application" : "Exploring"}</span>{job.fitness_score != null && <span className={styles.fitTag}>Fit {job.fitness_score}/10</span>}</div>
    <div className={styles.cardBottom}><span>Saved {formatDate(job.created_at)}</span><Link href={`/jobs/${job.id}?view=prepare`}>Prepare for this role →</Link></div>
  </article>;
}

const groups: { id: ApplicationGroup; title: string; detail: string }[] = [
  { id: "conversation", title: "Conversations & decisions", detail: "Review the latest exchange and decide your next move." },
  { id: "preparing", title: "Getting ready to send", detail: "Finish your materials and apply when you’re ready." },
  { id: "waiting", title: "Awaiting a response", detail: "Review your notes and decide whether a follow-up makes sense." },
  { id: "finished", title: "Past applications", detail: "Keep the record. Take the useful lessons forward." },
];

function ApplicationList({ jobs }: { jobs: JobRow[] }) {
  return <div className={styles.applicationGroups}>{groups.map((group) => {
    const rows = jobs.filter((j) => applicationGroup(j) === group.id);
    if (!rows.length) return null;
    return <section key={group.id}><div className={styles.groupHeading}><h3>{group.title} <span>{rows.length}</span></h3><p>{group.detail}</p></div>{rows.map((job) => <article key={job.id} className={styles.applicationRow}><span className={styles.companyLogo} aria-hidden="true">{job.company.slice(0, 2).toUpperCase()}</span><div className={styles.applicationTitle}><Link href={`/jobs/${job.id}?view=${group.id === "preparing" ? "prepare" : "application"}`}>{job.title || "Untitled role"}</Link><p>{job.company} · {job.applied_at ? `Applied ${formatDate(job.applied_at)}` : group.id === "preparing" ? "Not submitted yet" : "Submission date not recorded"}</p></div><span className={styles.tag}>{statusLabel(job.status)}</span><Link className={styles.rowAction} href={`/jobs/${job.id}?view=${group.id === "preparing" ? "prepare" : "application"}`}>{group.id === "preparing" ? "Prepare" : "Review"} →</Link></article>)}</section>;
  })}</div>;
}
