"use client";

import Link from "next/link";
import type { JobRow } from "@/lib/db/jobs";
import { STATUS_OPTIONS } from "@/lib/status";
import { applicationGroup } from "@/lib/search-workflow";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Selector } from "@/components/ui/Selector";
import { Banner } from "@/components/ui/Banner";
import { Icon } from "@/components/iconstack/Icon";
import { JobStatusDot } from "../icons";
import type { Draft } from "./useDraft";
import type { useJobStepper } from "./useJobStepper";
import styles from "./job.module.css";

export type HeaderFields = Pick<JobRow, "title" | "company" | "location" | "salary_text" | "url">;

export const EMPTY_HEADER: HeaderFields = { title: "", company: "", location: "", salary_text: "", url: "" };

interface JobHeaderProps {
  job: JobRow;
  draft: Draft<HeaderFields>;
  stepper: ReturnType<typeof useJobStepper>;
  onSave: () => void;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  error: string | null;
  onDismissError: () => void;
}

/** Where the job sits in the search, so the breadcrumb leads back there. */
function backLink(job: JobRow) {
  if (job.status === "saved") return { href: "/jobs?phase=explore", label: "Explore" };
  if (job.status === "applying") return { href: "/jobs?phase=prepare", label: "Prepare" };
  return applicationGroup(job) ? { href: "/jobs?phase=applications", label: "Applications" } : { href: "/jobs?view=tracker", label: "All jobs" };
}

export function JobHeader({ job, draft, stepper, onSave, onStatusChange, onDelete, error, onDismissError }: JobHeaderProps) {
  const fields = draft.value;
  const setField = (key: keyof HeaderFields) => (v: string) => draft.set({ ...fields, [key]: v });
  const back = backLink(job);
  const meta = [job.company, job.location, job.salary_text].filter(Boolean);

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div className={styles.title}>
          <Link href={back.href} className={styles.crumb}>{back.label} /</Link>
          <h1>{job.title || "Untitled role"}</h1>
        </div>
        <div className={styles.headerActions}>
          {stepper.total > 0 && (
            <div className={styles.stepper}>
              <Button label="Previous job" tooltip="Previous job (k)" variant="ghost" size="sm" isIconOnly icon={<Icon name="chevron-up" size={15} />} onClick={() => stepper.go(stepper.prevId)} isDisabled={!stepper.prevId} />
              <Button label="Next job" tooltip="Next job (j)" variant="ghost" size="sm" isIconOnly icon={<Icon name="chevron-down" size={15} />} onClick={() => stepper.go(stepper.nextId)} isDisabled={!stepper.nextId} />
              {stepper.index >= 0 && <span>{stepper.index + 1} of {stepper.total}</span>}
            </div>
          )}
          <Selector
            label="Status"
            isLabelHidden
            size="sm"
            className={styles.status}
            options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, icon: <JobStatusDot status={s.value} /> }))}
            value={job.status}
            onChange={onStatusChange}
          />
          {!draft.isOpen && (
            <Button
              label="Edit"
              variant="secondary"
              size="sm"
              icon={<Icon name="pencil" size={13} />}
              onClick={() => draft.open({ title: job.title, company: job.company, location: job.location, salary_text: job.salary_text, url: job.url })}
            />
          )}
          <Button label="Delete" tooltip="Delete job" variant="ghost" size="sm" isIconOnly icon={<Icon name="trash" size={15} />} onClick={onDelete} />
        </div>
      </div>

      {draft.isOpen ? (
        <form className={styles.editForm} onSubmit={(e) => { e.preventDefault(); onSave(); }}>
          <TextInput label="Job title" value={fields.title} onChange={setField("title")} size="sm" className={styles.wide} />
          <TextInput label="Company" value={fields.company} onChange={setField("company")} size="sm" />
          <TextInput label="Location" value={fields.location} onChange={setField("location")} size="sm" />
          <TextInput label="Salary" value={fields.salary_text} onChange={setField("salary_text")} size="sm" />
          <TextInput label="URL" value={fields.url} onChange={setField("url")} size="sm" />
          <div className={styles.editActions}>
            <Button label="Cancel" variant="secondary" size="sm" onClick={draft.close} />
            <Button label="Save" variant="primary" size="sm" type="submit" />
          </div>
        </form>
      ) : (
        <p className={styles.meta}>
          {meta.length ? meta.join(" · ") : "No company or location yet"}
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              Posting <Icon name="arrow-up-right" size={12} />
            </a>
          )}
        </p>
      )}

      {job.status === "closed" && !!job.auto_closed && job.previous_status && (
        <Banner
          status="warning"
          className={styles.headerBanner}
          title={<>An automated check marked this job closed. It was <strong>{job.previous_status}</strong>.</>}
          endContent={<Button label={`Restore to ${job.previous_status}`} variant="secondary" size="sm" onClick={() => onStatusChange(job.previous_status!)} />}
        />
      )}
      {error && <Banner status="error" className={styles.headerBanner} title={error} isDismissable onDismiss={onDismissError} />}
    </header>
  );
}
