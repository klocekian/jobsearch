"use client";

import { useEffect, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Banner } from "@astryxdesign/core/Banner";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";

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

function downloadSample(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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

export function CandidateProfilePanel() {
  const [docs, setDocs] = useState<DocsResponse | null>(null);
  const [profile, setProfile] = useState("");
  const [gaps, setGaps] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/candidate-docs")
      .then((r) => r.json())
      .then((d: DocsResponse) => {
        if (!active) return;
        setDocs(d);
        setProfile(d.profile ?? "");
        setGaps(d.gaps ?? "");
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const dirty = docs !== null && (profile !== docs.profile || gaps !== docs.gaps);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/candidate-docs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, gaps }),
      });
      const d = await res.json() as Partial<DocsResponse> & { error?: string };
      if (!res.ok) {
        setMessage({ kind: "error", text: d.error ?? "Save failed." });
        return;
      }
      setDocs((prev) => prev ? {
        ...prev,
        profile: d.profile ?? profile,
        gaps: d.gaps ?? gaps,
        profile_updated_at: d.profile_updated_at ?? prev.profile_updated_at,
        gaps_updated_at: d.gaps_updated_at ?? prev.gaps_updated_at,
      } : prev);
      setMessage({ kind: "success", text: "Saved." });
    } catch {
      setMessage({ kind: "error", text: "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Text type="supporting" color="secondary">Loading…</Text>;
  }

  const missing = [!profile.trim() && "positive profile", !gaps.trim() && "negative profile"]
    .filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <div>
        <Heading level={2} className="tracking-tight">Candidate Profile</Heading>
        <div className="mt-1">
          <Text type="supporting" color="secondary">
            Grounding for the fitness check. Both documents are required — without
            the negative profile the check degrades into a keyword matcher.
          </Text>
        </div>
      </div>

      {missing.length > 0 && (
        <div>
          <Banner
            status="warning"
            title={`Fitness check is unavailable until you add your ${missing.join(" and ")}.`}
          />
        </div>
      )}

      {canonMayBeStale(docs) && docs?.default_resume && (
        <div>
          <Banner
            status="info"
            title="Your master resume is newer than your fact canon."
            description={`"${docs.default_resume.name}" updated ${fmt(docs.default_resume.updated_at)} · positive profile last saved ${fmt(docs.profile_updated_at)}. Worth a look — they may have drifted apart.`}
          />
        </div>
      )}

      {message && (
        <div>
          <Banner status={message.kind} title={message.text} />
        </div>
      )}

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <Text type="supporting" color="secondary">
            Verified figures, ownership scope, technologies actually held. Last saved {fmt(docs?.profile_updated_at ?? null)}. {profile.length.toLocaleString()} characters.
          </Text>
          <Button
            label="Download sample profile.md"
            variant="ghost"
            size="sm"
            onClick={() => downloadSample("sample_profile.md", SAMPLE_PROFILE_MD)}
          />
        </div>
        <TextArea
          label="Positive profile (the fact canon)"
          value={profile}
          onChange={(v) => setProfile(v)}
          rows={16}
          className="font-mono"
          placeholder="Paste profile.md here"
        />
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <Text type="supporting" color="secondary">
            Keep this current. Every posting or interview that surfaces something
            you don&apos;t have earns a line — it is the one part of this that
            can&apos;t be regenerated. Last saved {fmt(docs?.gaps_updated_at ?? null)}. {gaps.length.toLocaleString()} characters.
          </Text>
          <Button
            label="Download sample gaps.md"
            variant="ghost"
            size="sm"
            onClick={() => downloadSample("sample_gaps.md", SAMPLE_GAPS_MD)}
          />
        </div>
        <TextArea
          label="Negative profile (gaps and standing reframes)"
          value={gaps}
          onChange={(v) => setGaps(v)}
          rows={16}
          className="font-mono"
          placeholder="Paste gaps.md here"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          label={saving ? "Saving…" : "Save"}
          onClick={save}
          isDisabled={saving || !dirty}
        />
        {dirty && <Text type="supporting" color="secondary">Unsaved changes.</Text>}
      </div>
    </div>
  );
}
