"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { JobRow } from "@/lib/db/jobs";
import { apiGet, apiSend, errorMessage } from "@/lib/api-client";
import { formatDate, formatSalary } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { applicationGroup, isExploring, type SearchPhase, type ApplicationGroup } from "@/lib/search-workflow";
import { saveJobListIds } from "@/lib/storage";
import { PrepareSpace } from "./PrepareSpace";
import styles from "./search.module.css";

const labels = { explore: "Explore", prepare: "Prepare", applications: "Applications" };

export function SearchHome({ jobs, phase, onJobChange, error, retry, initialFilter }: { jobs: JobRow[] | null; phase: SearchPhase; onJobChange: (job: JobRow) => void; error: string | null; retry: () => void; initialFilter: string | null }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(initialFilter === "shortlist" && phase === "explore" ? "shortlist" : "all");
  const [sort, setSort] = useState("recent");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const all = jobs ?? [];
  const exploring = all.filter(isExploring);
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
  const selected = visible.find((job) => job.id === selectedId) ?? visible[0];
  useEffect(() => { if (phase !== "prepare") saveJobListIds(visible.map((j) => j.id)); }, [visible, phase]);

  async function toggleShortlist(job: JobRow) {
    setPending(job.id); setActionError("");
    try {
      const result = await apiSend<{ job: JobRow }>(`/api/jobs/${job.id}`, "PATCH", { is_starred: job.is_starred ? 0 : 1 });
      onJobChange(result.job);
    } catch (err) { setActionError(errorMessage(err, "Could not update your shortlist. Try again.")); }
    finally { setPending(null); }
  }

  const filters = phase === "explore"
    ? [{ id: "all", label: "All opportunities", count: exploring.length }, { id: "shortlist", label: "Shortlisted", count: shortlist.length }, { id: "preparing", label: "Preparing", count: exploring.filter((j) => j.status === "applying").length }]
    : [{ id: "all", label: "All applications", count: applicationJobs.length }, { id: "active", label: "Active", count: applicationJobs.filter((j) => applicationGroup(j) !== "finished").length }, { id: "preparing", label: "Preparing", count: applicationJobs.filter((j) => j.status === "applying").length }];

  return <main className={styles.page}>
    <header className={styles.pageHeader}>
      <div className={styles.pageTitle}><span className={styles.breadcrumb}>Workspace /</span><h1>{labels[phase]}</h1></div>
      <div className={styles.headerActions}>
        {phase === "applications" && <Link className={styles.secondaryButton} href="/jobs?phase=prepare#learning">Feedback & learning</Link>}
        <Link className={styles.button} href="/jobs?add=1">+ Save a job</Link>
      </div>
    </header>
    {error && <div className={styles.error} role="alert">{error} <button onClick={retry}>Try again</button></div>}
    {actionError && <p className={styles.error} role="alert">{actionError}</p>}
    {phase === "prepare" ? <div className={styles.prepareContent}><PrepareSpace jobs={all} /></div> : <>
      <div className={styles.toolbar}>
        <div className={styles.filters} aria-label="Filter jobs">{filters.map((f) => <button key={f.id} aria-label={f.label} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}<span aria-hidden="true">{jobs ? f.count : "—"}</span></button>)}</div>
        <div className={styles.searchControls}><input aria-label="Search jobs" placeholder="Search jobs…" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Sort opportunities" value={sort} onChange={(e) => setSort(e.target.value)}><option value="recent">Newest first</option><option value="fit">Highest fit</option></select></div>
      </div>
      {all.some((j) => j.auto_closed) && <Link className={styles.closureNotice} href="/jobs?view=tracker">Posting checks found closed roles. Review changes →</Link>}
      {!jobs && !error && <p className={styles.empty} role="status">Loading jobs…</p>}
      {jobs && !visible.length && <div className={styles.empty}><h2>{query || filter !== "all" ? "No roles match this view" : phase === "explore" ? "No saved jobs yet" : "No applications yet"}</h2><p>{query || filter !== "all" ? "Try a different search or filter." : phase === "explore" ? "Save a posting to compare roles and start your shortlist." : "Jobs appear here when you start preparing an application or record a submission."}</p><Link className={styles.secondaryButton} href={phase === "explore" ? "/jobs?add=1" : "/jobs?phase=explore"}>{phase === "explore" ? "Save a job" : "Explore jobs"}</Link></div>}
      {visible.length > 0 && (phase === "explore" ? <div className={styles.exploreWorkspace}>
        <section className={styles.jobList} aria-label="Opportunities">
          <div className={styles.tableScroll}><table className={styles.jobsTable}>
            <thead><tr><th scope="col"><span className={styles.srOnly}>Shortlist</span></th><th scope="col">Role / Company</th><th scope="col" className={styles.locationColumn}>Location</th><th scope="col" className={styles.salaryColumn}>Salary</th><th scope="col">Fit</th><th scope="col" className={styles.statusColumn}>Status</th></tr></thead>
            <tbody>{visible.map((job) => <tr key={job.id} data-selected={selected?.id === job.id}>
              <td><button className={styles.star} aria-label={`${job.is_starred ? "Remove" : "Add"} ${job.company} ${job.title} ${job.is_starred ? "from" : "to"} shortlist`} aria-pressed={!!job.is_starred} onClick={() => void toggleShortlist(job)} disabled={pending !== null}>{job.is_starred ? "★" : "☆"}</button></td>
              <td><button className={styles.roleButton} onClick={() => setSelectedId(job.id)} aria-pressed={selected?.id === job.id} aria-label={`Preview ${job.company} ${job.title}`}><span className={styles.companyLogo} aria-hidden="true">{(job.company || "?").slice(0, 2).toUpperCase()}</span><span><strong>{job.title || "Untitled role"}</strong><small>{job.company || "Company not added"}</small></span></button></td>
              <td className={styles.locationColumn}><span>{job.location || "—"}</span><small>{job.remote_type && job.remote_type !== "unknown" ? job.remote_type : ""}</small></td>
              <td className={styles.salaryColumn}>{formatSalary(job) || "—"}</td>
              <td>{job.fitness_score != null ? <span className={styles.fitTag}>{job.fitness_score}<small>/10</small></span> : <span className={styles.subtle}>—</span>}</td>
              <td className={styles.statusColumn}><span className={styles.tag} data-status={job.status}>{job.status === "applying" ? "Preparing" : "Saved"}</span></td>
            </tr>)}</tbody>
          </table></div>
          <div className={styles.listFooter}><span>{visible.length} opportunities</span><Link href="/jobs?view=tracker">Open full tracker ↗</Link></div>
        </section>
        {selected && <JobInspector key={selected.id} job={selected} />}
      </div> : <ApplicationList jobs={visible} />)}
    </>}
  </main>;
}

function JobInspector({ job }: { job: JobRow }) {
  const [detail, setDetail] = useState<JobRow | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let ignore = false;
    apiGet<{ job: JobRow }>(`/api/jobs/${job.id}`, { cache: "no-store" }).then((data) => { if (!ignore) setDetail(data.job); })
      .catch((err) => { if (!ignore) setError(errorMessage(err, "Could not load the posting.")); });
    return () => { ignore = true; };
  }, [job.id]);
  return <aside className={styles.inspector} aria-label="Job preview">
    <div className={styles.inspectorHeading}><span>JOB PREVIEW</span><Link href={`/jobs/${job.id}`} aria-label="Open job workspace">↗</Link></div>
    <div className={styles.inspectorBody}>
      <span className={styles.companyLogo} aria-hidden="true">{job.company.slice(0, 2).toUpperCase()}</span>
      <h2>{job.title}</h2><p className={styles.inspectorCompany}>{job.company}{job.location ? ` · ${job.location}` : ""}</p>
      <div className={styles.inspectorActions}><Link className={styles.button} href={`/jobs/${job.id}?view=prepare`}>Prepare application →</Link><Link className={styles.secondaryButton} href={`/jobs/${job.id}`}>Evaluate fit</Link></div>
      <dl className={styles.jobProperties}><div><dt>Status</dt><dd>{statusLabel(job.status)}</dd></div><div><dt>Compensation</dt><dd>{formatSalary(job) || "Not listed"}</dd></div><div><dt>Saved</dt><dd>{formatDate(job.created_at)}</dd></div><div><dt>Resume match</dt><dd>{job.match_score != null ? `${job.match_score}/100` : "Not analyzed"}</dd></div></dl>
      <h3>Posting</h3>{error ? <p role="alert" className={styles.subtle}>{error} <Link href={`/jobs/${job.id}`}>Open job →</Link></p> : !detail ? <p role="status" className={styles.subtle}>Loading posting…</p> : <p className={styles.postingExcerpt}>{detail.posting_text ? detail.posting_text.slice(0, 1400) + (detail.posting_text.length > 1400 ? "…" : "") : "No posting text. Open the job to add it."}</p>}
      {detail?.notes && <><h3>Notes</h3><p className={styles.postingExcerpt}>{detail.notes.slice(0, 600)}</p></>}
      <Link className={styles.textLink} href={`/jobs/${job.id}`}>Open full workspace →</Link>
    </div>
  </aside>;
}

const groups: { id: ApplicationGroup; title: string }[] = [
  { id: "preparing", title: "Preparing" }, { id: "waiting", title: "Awaiting response" },
  { id: "conversation", title: "Conversations" }, { id: "finished", title: "Closed" },
];

function ApplicationList({ jobs }: { jobs: JobRow[] }) {
  return <section className={styles.applicationBoard} aria-label="Application pipeline">{groups.map((group) => {
    const rows = jobs.filter((j) => applicationGroup(j) === group.id);
    return <section key={group.id} className={styles.boardColumn}>
      <div className={styles.groupHeading}><span className={styles.stageDot} data-stage={group.id} /><h2>{group.title}</h2><span>{rows.length}</span></div>
      <div className={styles.boardCards}>{rows.map((job) => <article key={job.id} className={styles.applicationCard}>
        <div className={styles.applicationCompany}><span className={styles.companyLogo} aria-hidden="true">{job.company.slice(0, 2).toUpperCase()}</span>{job.company}</div>
        <Link className={styles.applicationTitle} href={`/jobs/${job.id}?view=${group.id === "preparing" ? "prepare" : "application"}`}>{job.title || "Untitled role"}</Link>
        <p className={styles.subtle}>{job.location || "Location not specified"}</p>
        <div className={styles.cardBottom}><span className={styles.tag} data-status={job.status}>{statusLabel(job.status)}</span><span>{job.applied_at ? formatDate(job.applied_at) : ""}</span></div>
        <Link className={styles.cardAction} href={`/jobs/${job.id}?view=${group.id === "preparing" ? "prepare" : "application"}`}>{group.id === "preparing" ? "Continue preparation" : "Review & update"} →</Link>
      </article>)}{!rows.length && <p className={styles.emptyColumn}>No applications</p>}</div>
    </section>;
  })}</section>;
}
