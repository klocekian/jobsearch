"use client";

import { useEffect, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Card } from "@astryxdesign/core/Card";
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
    <Card className="px-5 py-5">
      <Heading level={2} className="tracking-tight">Candidate Profile</Heading>
      <div className="mt-1">
        <Text type="supporting" color="secondary">
          Grounding for the fitness check. Both documents are required — without
          the negative profile the check degrades into a keyword matcher.
        </Text>
      </div>

      {missing.length > 0 && (
        <div className="mt-4">
          <Banner
            status="warning"
            title={`Fitness check is unavailable until you add your ${missing.join(" and ")}.`}
          />
        </div>
      )}

      {canonMayBeStale(docs) && docs?.default_resume && (
        <div className="mt-4">
          <Banner
            status="info"
            title="Your master resume is newer than your fact canon."
            description={`"${docs.default_resume.name}" updated ${fmt(docs.default_resume.updated_at)} · positive profile last saved ${fmt(docs.profile_updated_at)}. Worth a look — they may have drifted apart.`}
          />
        </div>
      )}

      {message && (
        <div className="mt-4">
          <Banner status={message.kind} title={message.text} />
        </div>
      )}

      <div className="mt-5">
        <div className="mb-1">
          <Text type="supporting" color="secondary">
            Verified figures, ownership scope, technologies actually held. Last saved {fmt(docs?.profile_updated_at ?? null)}. {profile.length.toLocaleString()} characters.
          </Text>
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

      <div className="mt-6">
        <div className="mb-1">
          <Text type="supporting" color="secondary">
            Keep this current. Every posting or interview that surfaces something
            you don&apos;t have earns a line — it is the one part of this that
            can&apos;t be regenerated. Last saved {fmt(docs?.gaps_updated_at ?? null)}. {gaps.length.toLocaleString()} characters.
          </Text>
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

      <div className="mt-5 flex items-center gap-3">
        <Button
          label={saving ? "Saving…" : "Save"}
          onClick={save}
          isDisabled={saving || !dirty}
        />
        {dirty && <Text type="supporting" color="secondary">Unsaved changes.</Text>}
      </div>
    </Card>
  );
}
