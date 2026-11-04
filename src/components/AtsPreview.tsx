import { getAtsPreview } from "@/lib/resume/ats-preview";

/** Best-effort, read-only fields from the saved resume text. */
export function AtsPreview({ resumeText }: { resumeText: string }) {
  const { name, contact, roles, skills, issues } = getAtsPreview(resumeText);
  const contactFields = [contact.email, contact.phone, contact.location, contact.website, contact.linkedin, contact.github].filter(Boolean);

  return (
    <details className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold text-primary">
        What the ATS sees{issues.length > 0 && <span className="ml-2 text-amber-700 dark:text-amber-400">{issues.length} to review</span>}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-secondary">Best-effort fields from the saved resume text.</p>
        {issues.length > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-100">
            <p className="font-semibold">Review these fields</p>
            <ul className="mt-1 list-disc pl-5">
              {issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
        )}
        <div>
          <h3 className="font-semibold text-primary">Name</h3>
          <p className="text-secondary">{name || "Not recognized"}</p>
        </div>
        <div>
          <h3 className="font-semibold text-primary">Contact</h3>
          {contactFields.length > 0 ? (
            <ul className="text-secondary">{contactFields.map((value) => <li key={value}>{value}</li>)}</ul>
          ) : <p className="text-secondary">Not recognized</p>}
        </div>
        <div>
          <h3 className="font-semibold text-primary">Roles and dates</h3>
          {roles.length > 0 ? (
            <ul className="space-y-1 text-secondary">
              {roles.map((entry, index) => (
                <li key={index}>{[entry.role || "Title not recognized", entry.company, entry.dates || "Dates not recognized"].filter(Boolean).join(" · ")}</li>
              ))}
            </ul>
          ) : <p className="text-secondary">No dated roles recognized</p>}
        </div>
        <div>
          <h3 className="font-semibold text-primary">Skills</h3>
          <p className="text-secondary">{skills.length > 0 ? skills.join(", ") : "Not recognized"}</p>
        </div>
      </div>
    </details>
  );
}
