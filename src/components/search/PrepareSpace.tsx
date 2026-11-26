"use client";

import Link from "next/link";
import { Icon } from "@/components/iconstack/Icon";
import { useEffect, useRef, useState } from "react";
import type { JobRow } from "@/lib/db/jobs";
import type { ResumeRow } from "@/lib/db/resumes";
import { apiGet, apiSend, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { readResumeFile } from "@/lib/extract";
import { EMPTY_SEARCH_PLAN, isExploring, type SearchPlan, type SkillPattern } from "@/lib/search-workflow";
import styles from "./search.module.css";

interface PlanResponse { plan: SearchPlan; patterns: SkillPattern[]; postingCount: number }

export function PrepareSpace({ jobs }: { jobs: JobRow[] }) {
  const [data, setData] = useState<PlanResponse | null>(null);
  const [plan, setPlan] = useState<SearchPlan>(EMPTY_SEARCH_PLAN);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  const dirty = data !== null && JSON.stringify(data.plan) !== JSON.stringify(plan);
  useUnsavedChanges(dirty);

  useEffect(() => {
    let ignore = false;
    apiGet<PlanResponse>("/api/search-plan", { cache: "no-store" }).then((result) => {
      if (!ignore) { setData(result); setPlan(result.plan); setError(""); }
    }).catch((err) => { if (!ignore) setError(errorMessage(err, "Could not load your preparation space.")); });
    return () => { ignore = true; };
  }, [reload]);

  async function savePlan() {
    setSaving(true); setSaved(false); setError("");
    try {
      const result = await apiSend<{ plan: SearchPlan }>("/api/search-plan", "PUT", plan);
      setData((current) => current ? { ...current, plan: result.plan } : null); setSaved(true);
    } catch (err) { setError(errorMessage(err, "Could not save your notes. Your edits are still here.")); }
    finally { setSaving(false); }
  }

  const update = (field: keyof SearchPlan, value: string) => { setPlan((p) => ({ ...p, [field]: value })); setSaved(false); };
  const ready = jobs.filter(isExploring).filter((j) => j.is_starred || j.status === "applying");
  return <div className={styles.prepareLayout}>
    <div className={styles.prepareMain}>
      <ResumeLibrary />
      <section className={styles.panel} id="learning">
        <div className={styles.sectionHeading}><h2>Feedback & learning</h2></div>
        <p className={styles.sectionDescription}>Record feedback and choose what to improve next.</p>
        {error && <div className={styles.error} role="alert">{error}{!data && <button onClick={() => setReload((n) => n + 1)}>Try again</button>}</div>}
        {!data && !error && <p role="status">Loading your notes…</p>}
        {data && <form onSubmit={(e) => { e.preventDefault(); void savePlan(); }} className={styles.planForm}>
          <label>Your search direction<span>What kind of work, team, or problem are you looking for?</span><textarea maxLength={4000} rows={3} value={plan.focus} onChange={(e) => update("focus", e.target.value)} placeholder="The roles I want to explore, and what matters to me…" disabled={saving} /></label>
          <div className={styles.formColumns}>
            <label>Feedback & reflections<span>What did you hear? What landed? What surprised you?</span><textarea maxLength={20000} rows={6} value={plan.feedback} onChange={(e) => update("feedback", e.target.value)} placeholder="After a conversation, capture the date, role, and what you learned…" disabled={saving} /></label>
            <label>What to improve or learn next<span>Turn a useful observation into a concrete next step.</span><textarea maxLength={20000} rows={6} value={plan.learning} onChange={(e) => update("learning", e.target.value)} placeholder="Practice a story, strengthen a resume example, build a skill…" disabled={saving} /></label>
          </div>
          <div className={styles.formFooter}><p aria-live="polite">{saved && !dirty ? "Your preparation notes are saved." : dirty ? "You have unsaved changes." : "Notes are saved to your account."}</p><button className={styles.button} disabled={saving || !dirty}>{saving ? "Saving…" : "Save preparation notes"}</button></div>
        </form>}
      </section>
    </div>
    <aside className={styles.sidebar}>
      <section className={styles.patternPanel}><h2>Recurring skills</h2><p className={styles.sectionDescription}>Skills mentioned across the saved roles you’re exploring.</p>
        {data ? <>
          {data.patterns.length ? <div className={styles.patterns}>{data.patterns.map((pattern) => <details key={pattern.skill}><summary><span>{pattern.skill}</span><span>{pattern.jobs.length} roles</span><Icon name="chevron-down" size={14} className={styles.disclosure} /></summary><ul>{pattern.jobs.map((job) => <li key={job.id}><Link href={`/jobs/${job.id}`}>{job.company} · {job.title} <Icon name="arrow-up-right" size={14} /></Link></li>)}</ul></details>)}</div> : <p className={styles.subtle}>No recurring skills found yet. Save at least two roles with posting text to start spotting patterns.</p>}
          <p className={styles.patternFootnote}>Based on {data.postingCount} saved or in-preparation postings with text, using our curated skill vocabulary. Matches are prompts to investigate, not proof of requirements or skill gaps.</p>
        </> : <p className={styles.subtle}>{error ? "Patterns are unavailable until loading succeeds." : "Reading your saved postings…"}</p>}
      </section>
      <section className={styles.asideNote}><h3>Tailor for a role</h3><p>Shortlisted roles and applications in preparation.</p>{ready.slice(0, 4).map((job) => <Link className={styles.prepJob} key={job.id} href={`/jobs/${job.id}?view=prepare`}><span>{job.title}<small>{job.company}</small></span><Icon name="arrow-right" size={16} /></Link>)}{!ready.length && <Link className={styles.textLink} href="/jobs?phase=explore">Shortlist a role to get started <Icon name="arrow-right" size={14} /></Link>}</section>
      <Link className={styles.noticeLink} href="/profile?tab=candidate">Review your experience & known gaps <Icon name="arrow-up-right" size={14} /></Link>
    </aside>
  </div>;
}

function ResumeLibrary() {
  const [resumes, setResumes] = useState<ResumeRow[] | null>(null);
  const [draft, setDraft] = useState<{ id: number | null; name: string; content: string } | null>(null);
  const [original, setOriginal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = draft !== null && JSON.stringify(draft) !== original;
  useUnsavedChanges(dirty);
  useEffect(() => {
    let ignore = false;
    apiGet<{ resumes: ResumeRow[] }>("/api/resumes", { cache: "no-store" }).then((result) => { if (!ignore) { setResumes(result.resumes); setError(""); } })
      .catch((err) => { if (!ignore) setError(errorMessage(err, "Could not load your resumes.")); });
    return () => { ignore = true; };
  }, [reload]);

  function edit(resume?: ResumeRow) {
    const next = { id: resume?.id ?? null, name: resume?.name ?? "", content: resume?.content ?? "" };
    setDraft(next); setOriginal(JSON.stringify(next)); setError(""); setMessage("");
  }
  async function save(asCopy: boolean) {
    if (!draft) return;
    setBusy(true); setError("");
    try {
      const isNew = !draft.id || asCopy;
      const result = await apiSend<{ resume: ResumeRow }>(isNew ? "/api/resumes" : `/api/resumes/${draft.id}`, isNew ? "POST" : "PATCH", { name: asCopy ? `${draft.name.trim().slice(0, 190)} (copy)` : draft.name.trim(), content: draft.content, ...(isNew ? { is_default: resumes?.length === 0 } : {}) });
      setResumes((list) => isNew ? [...(list ?? []), result.resume] : (list ?? []).map((r) => r.id === result.resume.id ? result.resume : r));
      setDraft(null); setMessage(isNew ? "Resume added to your library." : "Resume updated.");
    } catch (err) { setError(errorMessage(err, "Could not save this resume. Your draft is still here.")); }
    finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    try { const parsed = await readResumeFile(file); setDraft((d) => d ? { ...d, content: parsed.text, name: d.name || parsed.name } : d); }
    catch (err) { setError(errorMessage(err, "Could not read this file.")); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  return <section className={styles.panel}>
    <div className={styles.sectionHeading}><h2>Resumes</h2>{!draft && <button className={styles.button} onClick={() => edit()} disabled={resumes === null}><Icon name="plus" size={14} />Add resume</button>}</div>
    <p className={styles.sectionDescription}>Reusable versions. Select a resume to edit, or create a new version.</p>
    {error && <div className={styles.error} role="alert">{error}{!resumes && <button onClick={() => setReload((n) => n + 1)}>Try again</button>}</div>}
    {message && <p className={styles.success} role="status">{message}</p>}
    {!resumes && !error && <p role="status">Loading your resumes…</p>}
    {draft ? <form className={styles.resumeEditor} onSubmit={(e) => { e.preventDefault(); void save(false); }}>
      <label>Resume name<input maxLength={200} required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Product design leadership" disabled={busy} /></label>
      <div className={styles.uploadRow}><span>Start from a file, or write below.</span><button type="button" className={styles.secondaryButton} onClick={() => fileRef.current?.click()} disabled={busy}><Icon name="upload" size={14} />Upload resume</button><input ref={fileRef} type="file" accept=".pdf,.txt,.md,.docx" hidden onChange={(e) => void upload(e.target.files?.[0])} /></div>
      <label>Resume content<textarea aria-label="Resume content" required rows={14} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} disabled={busy} /></label>
      <div className={styles.editorActions}><button type="button" className={styles.secondaryButton} onClick={() => { if (!dirty || window.confirm("Discard your unsaved resume changes?")) setDraft(null); }} disabled={busy}>Cancel</button>{draft.id && <button type="button" className={styles.secondaryButton} disabled={busy || !draft.name.trim() || !draft.content.trim()} onClick={() => void save(true)}>Save as new version</button>}<button className={styles.button} disabled={busy || !draft.name.trim() || !draft.content.trim()}>{busy ? "Working…" : "Save resume"}</button></div>
    </form> : <div className={styles.resumeList}>
      {resumes?.map((resume) => <article key={resume.id} className={styles.resumeRow}><span className={styles.documentIcon} aria-hidden="true"><Icon name="file-text" size={20} /></span><div><h3>{resume.name} {!!resume.is_default && <span className={styles.tag}>Default</span>}</h3><p>Updated {formatDate(resume.updated_at)} · {resume.content.trim().split(/\s+/).filter(Boolean).length} words</p></div><button className={styles.secondaryButton} onClick={() => edit(resume)}>Edit</button></article>)}
      {resumes?.length === 0 && <div className={styles.empty}><h3>No resumes yet</h3><p>Upload or paste a resume to start preparing.</p><button className={styles.secondaryButton} onClick={() => edit()}>Add your first resume</button></div>}
    </div>}
  </section>;
}

/** Keep explicit-save forms safe across both Next links and full-page navigation. */
function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const navigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || event.ctrlKey || event.metaKey) return;
      if (link.pathname === location.pathname && link.search === location.search) return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
}
