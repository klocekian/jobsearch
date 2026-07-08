"use client";

import { useEffect, useMemo, useState } from "react";
import { extractContact, type Contact } from "@/lib/contact";
import { downloadCoverLetterPdf } from "@/lib/pdf/cover-letter";
import { loadCoverLetter, saveCoverLetter } from "@/lib/storage";
import { ContextMaterialsPanel } from "./ContextMaterialsPanel";
import { combinedContextText, type ContextMaterial } from "@/lib/context";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";

interface CoverLetterViewProps {
  resumeText: string;
  jobText: string;
  jobTitle: string;
  company: string;
  materials: ContextMaterial[];
  onMaterialsChange: (materials: ContextMaterial[]) => void;
}

type Status = "idle" | "loading" | "done" | "error";

function todayDisplay(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function CoverLetterView({
  resumeText,
  jobText,
  jobTitle,
  company,
  materials,
  onMaterialsChange,
}: CoverLetterViewProps) {
  const saved = useMemo(() => (typeof window === "undefined" ? null : loadCoverLetter()), []);

  const [interests, setInterests] = useState(saved?.interests ?? "");
  const [letter, setLetter] = useState(saved?.letter ?? "");
  const resumeContact = useMemo(() => extractContact(resumeText), [resumeText]);
  const [contact, setContact] = useState<Contact>(() => resumeContact);
  const [date, setDate] = useState(saved?.date ?? todayDisplay());

  useEffect(() => { setContact(resumeContact); }, [resumeContact]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const restored = saved !== null && saved.letter.trim().length > 0;

  useEffect(() => {
    saveCoverLetter({ letter, interests, contact, date });
  }, [letter, interests, contact, date]);

  const setField = (key: keyof Contact, value: string) =>
    setContact((prev) => ({ ...prev, [key]: value }));

  const generate = async () => {
    setStatus("loading");
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobText,
          jobTitle,
          interests,
          context: combinedContextText(materials),
        }),
      });
      const data: { letter?: string; error?: string } = await res.json();
      if (!res.ok || !data.letter) {
        throw new Error(data.error ?? `Request failed (${res.status}).`);
      }
      setLetter(data.letter);
      setStatus("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadPdf = () =>
    downloadCoverLetterPdf({ contact, body: letter, date, company });

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <Heading level={2}>Cover Letter</Heading>
          <Text>
            Generated from your resume and this job posting — grounded in your real experience, never
            fabricated. Add a note below about what draws you to the role, then edit the draft and save
            it as a PDF. Your draft is saved and restored as you work.
          </Text>
          {restored && (
            <Text>Restored your saved draft.</Text>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            label={status === "loading" ? "Writing…" : letter ? "Regenerate" : "Generate"}
            variant="primary"
            size="sm"
            onClick={generate}
            isDisabled={status === "loading"}
          />
          <Button
            label="Download PDF"
            variant="primary"
            size="sm"
            onClick={downloadPdf}
            isDisabled={!letter.trim()}
          />
        </div>
      </div>

      <div className="mb-4">
        <ContextMaterialsPanel materials={materials} onChange={onMaterialsChange} />
      </div>

      <TextArea
        label="What interests you about this role? (optional)"
        value={interests}
        onChange={setInterests}
        rows={4}
        placeholder="e.g. I've wanted to work on consumer subscription products at scale, and the AI-first pivot is exactly the kind of ambiguity I like leading through."
      />

      {status === "error" && (
        <div className="mt-4">
          <Banner status="error" title={error} />
        </div>
      )}

      {status === "loading" && (
        <div className="mt-6 flex justify-center">
          <Spinner />
        </div>
      )}

      {letter && status !== "loading" && (
        <>
          <Card className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <Heading level={3}>Letter header</Heading>
              <Button
                label="Reset from resume"
                variant="ghost"
                size="sm"
                onClick={() => setContact(resumeContact)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Full name" value={contact.name} onChange={(v) => setField("name", v)} placeholder="Your name" />
              <TextInput label="Address / location" value={contact.address} onChange={(v) => setField("address", v)} placeholder="San Francisco, CA" />
              <TextInput label="Email" value={contact.email} onChange={(v) => setField("email", v)} placeholder="you@email.com" />
              <TextInput label="Phone" value={contact.phone} onChange={(v) => setField("phone", v)} placeholder="(415) 555-0148" />
              <TextInput label="Website / portfolio" value={contact.website} onChange={(v) => setField("website", v)} placeholder="yoursite.com" />
              <TextInput label="Date" value={date} onChange={setDate} placeholder="June 16, 2026" />
            </div>
          </Card>

          <Card className="mt-4">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5">
              <Text type="supporting">Draft — edit as needed</Text>
              <div className="flex gap-2">
                <Button
                  label={copied ? "Copied!" : "Copy"}
                  variant="ghost"
                  size="sm"
                  onClick={copy}
                />
                <Button
                  label="Download PDF"
                  variant="primary"
                  size="sm"
                  onClick={downloadPdf}
                  isDisabled={!letter.trim()}
                />
              </div>
            </div>
            <TextArea
              label="Cover letter body"
              isLabelHidden
              value={letter}
              onChange={setLetter}
              rows={16}
            />
          </Card>
        </>
      )}
    </div>
  );
}
