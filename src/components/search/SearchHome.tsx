"use client";

import Link from "next/link";
import { Icon } from "@/components/iconstack/Icon";
import { Tooltip } from "@/components/ui/Tooltip";
import { useEffect, useMemo, useState } from "react";
import type { JobRow } from "@/lib/db/jobs";
import { apiGet, apiSend, errorMessage } from "@/lib/api-client";
import { formatDate, formatSalary } from "@/lib/format";
import { STATUS_OPTIONS, statusLabel } from "@/lib/status";
import { applicationGroup, isExploring, type SearchPhase, type ApplicationGroup } from "@/lib/search-workflow";
import { loadExploreSort, saveExploreSort, saveJobListIds } from "@/lib/storage";
import { useStoredValue } from "@/hooks/useStoredValue";
import { SortButton, nextSort, sortRows, type Sort, type SortDirection } from "@/components/ui/Table";
import { onRovingKeyDown } from "@/components/ui/rovingKeys";
import { PrepareSpace } from "./PrepareSpace";
import styles from "./search.module.css";

const labels = { explore: "Explore", prepare: "Prepare", applications: "Applications" };

// What each sort orders by, which way a header's first click goes, and how the sort menu names each direction.
const statusRank = (status: string) => STATUS_OPTIONS.findIndex((s) => s.value === status);
const SORTS = {
  created: { value: (j: JobRow) => j.created_at, first: "descending", names: ["Oldest first", "Newest first"] },
  starred: { value: (j: JobRow) => j.is_starred, first: "descending", names: ["Shortlisted last", "Shortlisted first"] },
  title: { value: (j: JobRow) => j.title, first: "ascending", names: ["Role A–Z", "Role Z–A"] },
  company: { value: (j: JobRow) => j.company, first: "ascending", names: ["Company A–Z", "Company Z–A"] },
  location: { value: (j: JobRow) => j.location, first: "ascending", names: ["Location A–Z", "Location Z–A"] },
  salary: { value: (j: JobRow) => j.salary_max ?? j.salary_min, first: "descending", names: ["Lowest salary", "Highest salary"] },
  fit: { value: (j: JobRow) => j.fitness_score, first: "descending", names: ["Lowest fit", "Highest fit"] },
  status: { value: (j: JobRow) => statusRank(j.status), first: "ascending", names: ["Earliest stage first", "Furthest stage first"] },
} satisfies Record<string, { value: (j: JobRow) => string | number | null; first: SortDirection; names: [string, string] }>;
type SortKey = keyof typeof SORTS;
const SORT_MENU: Sort<SortKey>[] = [
  { key: "created", direction: "descending" }, { key: "created", direction: "ascending" }, { key: "fit", direction: "descending" },
  { key: "salary", direction: "descending" }, { key: "title", direction: "ascending" }, { key: "company", direction: "ascending" },
];
const sortId = (s: Sort<SortKey>) => `${s.key}:${s.direction}`;
const sortName = (s: Sort<SortKey>) => SORTS[s.key].names[s.direction === "ascending" ? 0 : 1];
function parseSort(id: string): Sort<SortKey> {
  const [key, direction] = id.split(":");
  return key in SORTS && (direction === "ascending" || direction === "descending") ? { key: key as SortKey, direction } : { key: "created", direction: "descending" };
}

export function SearchHome({ jobs, phase, onJobChange, error, retry, initialFilter }: { jobs: JobRow[] | null; phase: SearchPhase; onJobChange: (job: JobRow) => void; error: string | null; retry: () => void; initialFilter: string | null }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(initialFilter === "shortlist" && phase === "explore" ? "shortlist" : "all");
  const [sortValue, setSortValue] = useStoredValue(loadExploreSort, saveExploreSort, "created:descending");
  const sort = parseSort(sortValue);
  const sortBy = (key: SortKey) => setSortValue(sortId(nextSort(sort, key, SORTS[key].first)));
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
    // Newest first within ties, whatever the sort.
    const newest = sortRows(list, SORTS.created.value, "descending");
    return sort.key === "created" ? sortRows(list, SORTS.created.value, sort.direction) : sortRows(newest, SORTS[sort.key].value, sort.direction);
  }, [jobs, phase, filter, query, sort.key, sort.direction]);
  const selected = visible.find((job) => job.id === selectedId) ?? visible[0];
  useEffect(() => { if (phase !== "prepare") saveJobListIds(visible.map((j) => j.id)); }, [visible, phase]);

  // j/k anywhere (outside fields), or ↑/↓ within the list, step through the preview.
  useEffect(() => {
    if (phase !== "explore" || !selected) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      const inList = !!t.closest("[data-job-list]");
      const step = e.key === "j" || (inList && e.key === "ArrowDown") ? 1 : e.key === "k" || (inList && e.key === "ArrowUp") ? -1 : 0;
      if (!step) return;
      const next = visible[visible.indexOf(selected) + step];
      if (!next) return;
      e.preventDefault();
      setSelectedId(next.id);
      const button = document.querySelector<HTMLElement>(`[data-job-row="${next.id}"] [data-preview]`);
      button?.scrollIntoView({ block: "nearest" });
      if (inList) button?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, selected, visible]);

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
        <Link className={styles.button} href="/jobs?add=1"><Icon name="plus" size={14} />Save a job</Link>
      </div>
    </header>
    {error && <div className={styles.error} role="alert">{error} <button onClick={retry}>Try again</button></div>}
    {actionError && <p className={styles.error} role="alert">{actionError}</p>}
    {phase === "prepare" ? <div className={styles.prepareContent}><PrepareSpace jobs={all} /></div> : <>
      <div className={styles.toolbar}>
        <div role="group" className={styles.filters} aria-label="Filter jobs" onKeyDown={(e) => onRovingKeyDown(e, setFilter)}>{filters.map((f) => <button key={f.id} data-value={f.id} tabIndex={filter === f.id ? 0 : -1} aria-label={f.label} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}<span aria-hidden="true">{jobs ? f.count : "—"}</span></button>)}</div>
        <div className={styles.searchControls}><input aria-label="Search jobs" placeholder="Search jobs…" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Sort opportunities" value={sortId(sort)} onChange={(e) => setSortValue(e.target.value)}>{(SORT_MENU.some((m) => sortId(m) === sortId(sort)) ? SORT_MENU : [...SORT_MENU, sort]).map((m) => <option key={sortId(m)} value={sortId(m)}>{sortName(m)}</option>)}</select></div>
      </div>
      {all.some((j) => j.auto_closed) && <Link className={styles.closureNotice} href="/jobs?view=tracker">Posting checks found closed roles. Review changes <Icon name="arrow-right" size={14} /></Link>}
      {!jobs && !error && <p className={styles.empty} role="status">Loading jobs…</p>}
      {jobs && !visible.length && <div className={styles.empty}><h2>{query || filter !== "all" ? "No roles match this view" : phase === "explore" ? "No saved jobs yet" : "No applications yet"}</h2><p>{query || filter !== "all" ? "Try a different search or filter." : phase === "explore" ? "Save a posting to compare roles and start your shortlist." : "Jobs appear here when you start preparing an application or record a submission."}</p><Link className={styles.secondaryButton} href={phase === "explore" ? "/jobs?add=1" : "/jobs?phase=explore"}>{phase === "explore" ? "Save a job" : "Explore jobs"}</Link></div>}
      {visible.length > 0 && (phase === "explore" ? <div className={styles.exploreWorkspace}>
        <section className={styles.jobList} aria-label="Opportunities">
          <div className={styles.tableScroll}><table className={styles.jobsTable}>
            <thead><tr>
              <th scope="col" aria-sort={ariaSort(sort, "starred")}><SortButton active={sort.key === "starred"} direction={sort.direction} onClick={() => sortBy("starred")} label="Sort by shortlist"><Icon name="star" size={11} /></SortButton></th>
              <th scope="col" aria-sort={ariaSort(sort, "title") ?? ariaSort(sort, "company")}><SortButton active={sort.key === "title"} direction={sort.direction} onClick={() => sortBy("title")}>Role</SortButton> / <SortButton active={sort.key === "company"} direction={sort.direction} onClick={() => sortBy("company")}>Company</SortButton></th>
              <th scope="col" className={styles.locationColumn} aria-sort={ariaSort(sort, "location")}><SortButton active={sort.key === "location"} direction={sort.direction} onClick={() => sortBy("location")}>Location</SortButton></th>
              <th scope="col" className={styles.salaryColumn} aria-sort={ariaSort(sort, "salary")}><SortButton active={sort.key === "salary"} direction={sort.direction} onClick={() => sortBy("salary")}>Salary</SortButton></th>
              <th scope="col" aria-sort={ariaSort(sort, "fit")}><SortButton active={sort.key === "fit"} direction={sort.direction} onClick={() => sortBy("fit")}>Fit</SortButton></th>
              <th scope="col" className={styles.statusColumn} aria-sort={ariaSort(sort, "status")}><SortButton active={sort.key === "status"} direction={sort.direction} onClick={() => sortBy("status")}>Status</SortButton></th>
            </tr></thead>
            <tbody data-job-list>{visible.map((job) => <tr key={job.id} data-job-row={job.id} data-selected={selected?.id === job.id}>
              <td><Tooltip content={job.is_starred ? "Remove from shortlist" : "Add to shortlist"}><button className={styles.star} aria-label={`${job.is_starred ? "Remove" : "Add"} ${job.company} ${job.title} ${job.is_starred ? "from" : "to"} shortlist`} aria-pressed={!!job.is_starred} onClick={() => void toggleShortlist(job)} disabled={pending !== null}><Icon name="star" size={17} fill={job.is_starred ? "currentColor" : "none"} /></button></Tooltip></td>
              <td><button data-preview className={styles.roleButton} onClick={() => setSelectedId(job.id)} aria-pressed={selected?.id === job.id} aria-label={`Preview ${job.company} ${job.title}`}><span className={styles.companyLogo} aria-hidden="true">{(job.company || "?").slice(0, 2).toUpperCase()}</span><span><strong>{job.title || "Untitled role"}</strong><small>{job.company || "Company not added"}</small></span></button></td>
              <td className={styles.locationColumn}><span>{job.location || "—"}</span><small>{job.remote_type && job.remote_type !== "unknown" ? job.remote_type : ""}</small></td>
              <td className={styles.salaryColumn}>{formatSalary(job) || "—"}</td>
              <td>{job.fitness_score != null ? <span className={styles.fitTag}>{job.fitness_score}<small>/10</small></span> : <span className={styles.subtle}>—</span>}</td>
              <td className={styles.statusColumn}><span className={styles.tag} data-status={job.status}>{job.status === "applying" ? "Preparing" : "Saved"}</span></td>
            </tr>)}</tbody>
          </table></div>
          <div className={styles.listFooter}><span>{visible.length} opportunities<span className={styles.keyHint}> · <kbd>j</kbd> <kbd>k</kbd> to move through them</span></span><Link href="/jobs?view=tracker">Open full tracker <Icon name="arrow-up-right" size={14} /></Link></div>
        </section>
        {selected && <JobInspector key={selected.id} job={selected} />}
      </div> : <ApplicationList jobs={visible} />)}
    </>}
  </main>;
}

const ariaSort = (sort: Sort<SortKey>, key: SortKey) => (sort.key === key ? sort.direction : undefined);

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
    <div className={styles.inspectorHeading}><span>JOB PREVIEW</span><Tooltip content="Open job workspace"><Link href={`/jobs/${job.id}`} aria-label="Open job workspace"><Icon name="arrow-up-right" size={17} /></Link></Tooltip></div>
    <div className={styles.inspectorBody}>
      <span className={styles.companyLogo} aria-hidden="true">{job.company.slice(0, 2).toUpperCase()}</span>
      <h2>{job.title}</h2><p className={styles.inspectorCompany}>{job.company}{job.location ? ` · ${job.location}` : ""}</p>
      <div className={styles.inspectorActions}><Link className={styles.button} href={`/jobs/${job.id}?view=prepare`}>Prepare application <Icon name="arrow-right" size={14} /></Link><Link className={styles.secondaryButton} href={`/jobs/${job.id}`}>Evaluate fit</Link></div>
      <dl className={styles.jobProperties}><div><dt>Status</dt><dd>{statusLabel(job.status)}</dd></div><div><dt>Compensation</dt><dd>{formatSalary(job) || "Not listed"}</dd></div><div><dt>Saved</dt><dd>{formatDate(job.created_at)}</dd></div><div><dt>Resume match</dt><dd>{job.match_score != null ? `${job.match_score}/100` : "Not analyzed"}</dd></div></dl>
      <h3>Posting</h3>{error ? <p role="alert" className={styles.subtle}>{error} <Link href={`/jobs/${job.id}`}>Open job <Icon name="arrow-right" size={14} /></Link></p> : !detail ? <p role="status" className={styles.subtle}>Loading posting…</p> : <p className={styles.postingExcerpt}>{detail.posting_text ? detail.posting_text.slice(0, 1400) + (detail.posting_text.length > 1400 ? "…" : "") : "No posting text. Open the job to add it."}</p>}
      {detail?.notes && <><h3>Notes</h3><p className={styles.postingExcerpt}>{detail.notes.slice(0, 600)}</p></>}
      <Link className={styles.textLink} href={`/jobs/${job.id}`}>Open full workspace <Icon name="arrow-right" size={14} /></Link>
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
        <Link className={styles.cardAction} href={`/jobs/${job.id}?view=${group.id === "preparing" ? "prepare" : "application"}`}>{group.id === "preparing" ? "Continue preparation" : "Review & update"} <Icon name="arrow-right" size={14} /></Link>
      </article>)}{!rows.length && <p className={styles.emptyColumn}>No applications</p>}</div>
    </section>;
  })}</section>;
}
