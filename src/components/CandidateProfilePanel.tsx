"use client";

import { useEffect, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { apiGet, apiSend, errorMessage } from "@/lib/api-client";
import { downloadText } from "@/lib/download";
import { downloadMarkdownPdf } from "@/lib/pdf/markdown";
import { DownloadMenu } from "./DownloadMenu";
import { DocumentField } from "./DocumentField";
import { useDraft, type Draft } from "./job-workspace/useDraft";

/**
 * Editor for the two documents the fitness check runs against.
 *
 * These are not resumes. The positive profile is the fact canon — what can be
 * claimed directly. The negative profile is what he does not have, split into
 * hard gaps and reframable gaps with their standing reframes.
 *
 * The negative profile is the asset here. No commercial match tool has one,
 * which is why none of them can produce a MISS: they score similarity, and
 * similarity is highest exactly when a posting speaks your own vocabulary.
 */

const SAMPLE_PROFILE_MD = `# Candidate Fact Canon (Positive Profile)

## Summary & Core Positioning
- Technical Lead & Principal/Senior Software Engineer with 8+ years experience designing, building, and operating high-scale cloud platforms and web applications.
- Track record of leading architecture migrations, scaling multi-tenant SaaS systems, and mentoring engineering teams.

## Core Disciplines & Expertise
- **Languages**: TypeScript, JavaScript, Python, Go, SQL, HTML/CSS
- **Frontend**: React, Next.js, Tailwind CSS, WebSockets, State Management, Core Web Vitals optimization
- **Backend & APIs**: Node.js, Express, REST APIs, GraphQL, gRPC, Microservices architecture
- **Databases & Storage**: PostgreSQL, SQLite, Redis, DynamoDB, query optimization & indexing
- **Cloud & Infrastructure**: AWS (ECS, Lambda, S3, RDS, CloudFront), Docker, CI/CD (GitHub Actions), Vercel, Terraform
- **Testing & Quality**: Vitest, Jest, Playwright, Cypress, automated regression suites

## Verified Career History & Key Achievements

### Senior Software Engineer / Tech Lead · Example Systems (2022 – Present)
- Architected and shipped event-driven data ingestion pipeline handling 10M+ daily events with 99.99% uptime.
- Led cross-functional team of 6 engineers across frontend, backend, and DevOps.
- Reduced API response p99 latency by 45% through query optimization and Redis caching layer.

### Full-Stack Software Engineer · Beta Labs (2019 – 2022)
- Built customer-facing dashboard and workflow builder using React, TypeScript, and Node.js.
- Automated CI/CD deployment pipelines, cutting deployment cycle times from 45 minutes to 6 minutes.
- Integrated third-party APIs including Stripe payments, OAuth providers, and webhook delivery.

## Education & Certifications
- B.S. in Computer Science (or equivalent practical experience)
- AWS Certified Solutions Architect
`;

const SAMPLE_GAPS_MD = `# Candidate Negative Profile (Gaps & Standing Reframes)

Grounding for fitness checks. Listed items prevent false-positive keyword matching and give honest qualification boundaries.

## 1. Hard Stops & Non-Negotiables
- **Travel**: No roles requiring >25% travel.
- **Location**: Remote or hybrid within local commuting distance (no 5 days/week full on-site relocation).
- **Security Clearance**: No active US government security clearance (TS/SCI).

## 2. Hard Gaps (Never touched / No adjacent experience)
- **Languages / Frameworks**: Rust, C++, C#, .NET, Java/Spring Boot (only modern TypeScript, Python, Go).
- **Domains**: Embedded systems firmware, low-level kernel drivers, biomedical device clinical trials.
- **Platforms**: Salesforce Apex development, SAP ABAP.

## 3. Reframable Gaps & Standing Reframes
- **Kubernetes**: No production cluster administration; standing reframe is production containerization with Docker and deployments via AWS ECS / serverless containers.
- **Data Engineering (Spark/Hadoop)**: Have not run petabyte Spark clusters; standing reframe is production relational ETL pipelines, SQL warehousing, and Redis pub/sub streaming.
- **Management vs Technical Leadership**: 3 years leading technical architecture and agile execution as Tech Lead / Staff Engineer rather than HR people management.
- **Years of Experience Near-Miss**: 8 years total software engineering; if a role asks for 10+ years in general full-stack, reframe on depth of systems architecture and rapid modern stack execution.
`;

interface DocsResponse {
  profile: string;
  gaps: string;
  profile_updated_at: string | null;
  gaps_updated_at: string | null;
  default_resume: { name: string; updated_at: string } | null;
}

function fmt(ts: string | null): string {
  if (!ts) return "never";
  const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleDateString();
}

/** True when the master resume moved after the fact canon was last reviewed. */
function canonMayBeStale(docs: DocsResponse | null): boolean {
  if (!docs?.default_resume || !docs.profile_updated_at) return false;
  const resume = new Date(docs.default_resume.updated_at.replace(" ", "T") + "Z").getTime();
  const canon = new Date(docs.profile_updated_at.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(resume) || Number.isNaN(canon)) return false;
  return resume > canon;
}

interface CandidateProfilePanelProps {
  /** Inside the job workspace: no page heading. */
  embedded?: boolean;
}


type DocKind = "profile" | "gaps";

export function CandidateProfilePanel({ embedded = false }: CandidateProfilePanelProps = {}) {
  const [docs, setDocs] = useState<DocsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const profileDraft = useDraft("");
  const gapsDraft = useDraft("");

  useEffect(() => {
    let active = true;
    apiGet<DocsResponse>("/api/candidate-docs")
      .then((d) => { if (active) setDocs(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const profile = docs?.profile ?? "";
  const gaps = docs?.gaps ?? "";

  // Each document saves on its own; the other goes along unchanged.
  const save = async (kind: DocKind) => {
    const draft = kind === "profile" ? profileDraft : gapsDraft;
    setSaving(true);
    setMessage(null);
    try {
      const body = { profile, gaps, [kind]: draft.value };
      const d = await apiSend<Partial<DocsResponse>>("/api/candidate-docs", "PUT", body);
      setDocs((prev) => prev ? {
        ...prev,
        profile: d.profile ?? body.profile,
        gaps: d.gaps ?? body.gaps,
        profile_updated_at: d.profile_updated_at ?? prev.profile_updated_at,
        gaps_updated_at: d.gaps_updated_at ?? prev.gaps_updated_at,
      } : prev);
      draft.close();
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err, "Save failed.") });
    } finally {
      setSaving(false);
    }
  };

  // Both saved documents in one file.
  const combinedMarkdown = () =>
    [profile.trim(), gaps.trim()].filter(Boolean).join("\n\n---\n\n") + "\n";

  const downloadPdf = async () => {
    setExporting(true);
    try {
      await downloadMarkdownPdf("Candidate Profile", combinedMarkdown());
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err, "Could not build the PDF.") });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <Text type="supporting" color="secondary">Loading…</Text>;
  }

  const missing = [!profile.trim() && "positive profile", !gaps.trim() && "negative profile"]
    .filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {embedded ? (
          <Text type="supporting" color="secondary">
            Grounding for the fitness check. Both documents are required.
          </Text>
        ) : (
          <div>
            <Heading level={2} className="tracking-tight">Candidate Profile</Heading>
            <div className="mt-0.5">
              <Text type="supporting" color="secondary">
                Grounding for the fitness check. Both documents are required.
              </Text>
            </div>
          </div>
        )}
        <DownloadMenu
          onPdf={downloadPdf}
          onMarkdown={() => downloadText("Candidate Profile.md", combinedMarkdown())}
          isDisabled={!profile.trim() && !gaps.trim()}
          busy={exporting}
        />
      </div>

      {/* In the job workspace this lives with the fitness scorer (Profile tab). */}
      {!embedded && missing.length > 0 && (
        <Banner
          status="warning"
          title={`Fitness check is unavailable until you add your ${missing.join(" and ")}.`}
        />
      )}

      {canonMayBeStale(docs) && docs?.default_resume && (
        <Banner
          status="info"
          title="Your master resume is newer than your fact canon."
          description={`"${docs.default_resume.name}" updated ${fmt(docs.default_resume.updated_at)} · positive profile last saved ${fmt(docs.profile_updated_at)}. Worth a look — they may have drifted apart.`}
        />
      )}

      {message && <Banner status={message.kind} title={message.text} />}

      <ProfileDoc
        title="Positive profile (the fact canon)"
        help={`Verified figures, ownership scope, technologies actually held. Last saved ${fmt(docs?.profile_updated_at ?? null)}.`}
        value={profile}
        draft={profileDraft}
        saving={saving}
        onSave={() => save("profile")}
        placeholder="Not written yet — paste your profile.md."
        sample={{ name: "sample_profile.md", content: SAMPLE_PROFILE_MD }}
      />

      <ProfileDoc
        title="Negative profile (gaps and standing reframes)"
        help={`Keep this current. Every posting or interview that surfaces something you don't have earns a line — it is the one part of this that can't be regenerated. Last saved ${fmt(docs?.gaps_updated_at ?? null)}.`}
        value={gaps}
        draft={gapsDraft}
        saving={saving}
        onSave={() => save("gaps")}
        placeholder="Not written yet — paste your gaps.md."
        sample={{ name: "sample_gaps.md", content: SAMPLE_GAPS_MD }}
      />
    </div>
  );
}

interface ProfileDocProps {
  title: string;
  help: string;
  value: string;
  draft: Draft<string>;
  saving: boolean;
  onSave: () => void;
  placeholder: string;
  sample: { name: string; content: string };
}

/** One profile document: read as Markdown until Edit, then the same surface takes input. */
function ProfileDoc({ title, help, value, draft, saving, onSave, placeholder, sample }: ProfileDocProps) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Text weight="semibold">{title}</Text>
        {draft.isOpen ? (
          <div className="ml-auto flex shrink-0 gap-2">
            <Button label="Cancel" variant="secondary" size="sm" onClick={draft.close} isDisabled={saving} />
            <Button label={saving ? "Saving…" : "Save"} variant="primary" size="sm" onClick={onSave} isDisabled={saving} />
          </div>
        ) : (
          <Button label="Edit" variant="secondary" size="sm" onClick={() => draft.open(value)} />
        )}
      </div>
      <div className="mb-2">
        <Text type="supporting" color="secondary">
          {help}{" "}
          <button type="button" className="cursor-pointer underline hover:no-underline" onClick={() => downloadText(sample.name, sample.content)}>
            Download a sample
          </button>
        </Text>
      </div>
      <DocumentField
        label={title}
        value={value}
        format="markdown"
        editing={draft.isOpen}
        draft={draft.value}
        onDraftChange={draft.set}
        placeholder={placeholder}
      />
    </div>
  );
}
