"use client";

import { useEffect, useMemo, useState } from "react";
import { extractContact, type Contact } from "@/lib/contact";
import { downloadCoverLetterPdf } from "@/lib/pdf/cover-letter";
import { loadCoverLetter, saveCoverLetter } from "@/lib/storage";
import { ContextMaterialsPanel } from "./ContextMaterialsPanel";
import { combinedContextText, type ContextMaterial } from "@/lib/context";

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
  // Restore the full draft (letter, interests, header, date) so it survives tab
  // switches and the session. Read once on mount (client-only — no SSR here).
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

  // Persist the whole draft on any change so navigating away keeps the edits.
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Cover Letter</h2>
          <p className="mt-1 text-sm text-slate-500">
            Generated from your resume and this job posting — grounded in your real experience, never
            fabricated. Add a note below about what draws you to the role, then edit the draft and save
            it as a PDF. Your draft is saved and restored as you work.
          </p>
          {restored && (
            <p className="mt-1 text-xs text-emerald-600">Restored your saved draft.</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={generate}
            disabled={status === "loading"}
            className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? "Writing…" : letter ? "Regenerate" : "Generate"}
          </button>
          <button
            onClick={downloadPdf}
            disabled={!letter.trim()}
            className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>
      </div>

      <div className="mb-4">
        <ContextMaterialsPanel materials={materials} onChange={onMaterialsChange} />
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          What interests you about this role? (optional)
        </span>
        <textarea
          className="input h-24 resize-y text-sm"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="e.g. I've wanted to work on consumer subscription products at scale, and the AI-first pivot is exactly the kind of ambiguity I like leading through."
        />
      </label>

      {status === "error" && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      {status === "loading" && (
        <div className="mt-6 space-y-3" aria-hidden>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-slate-100" style={{ width: `${90 - i * 7}%` }} />
          ))}
        </div>
      )}

      {letter && status !== "loading" && (
        <>
          {/* Header / contact details that print at the top of the PDF */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Letter header</h3>
              <button
                type="button"
                onClick={() => setContact(resumeContact)}
                title="Re-detect name, location, phone, etc. from your résumé"
                className="rounded-md px-2 py-1 text-xs font-medium text-brand transition hover:bg-slate-100"
              >
                Reset from résumé
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <input className="input" value={contact.name} onChange={(e) => setField("name", e.target.value)} placeholder="Your name" />
              </Field>
              <Field label="Address / location">
                <input className="input" value={contact.address} onChange={(e) => setField("address", e.target.value)} placeholder="San Francisco, CA" />
              </Field>
              <Field label="Email">
                <input className="input" value={contact.email} onChange={(e) => setField("email", e.target.value)} placeholder="you@email.com" />
              </Field>
              <Field label="Phone">
                <input className="input" value={contact.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="(415) 555-0148" />
              </Field>
              <Field label="Website / portfolio">
                <input className="input" value={contact.website} onChange={(e) => setField("website", e.target.value)} placeholder="yoursite.com" />
              </Field>
              <Field label="Date">
                <input className="input" value={date} onChange={(e) => setDate(e.target.value)} placeholder="June 16, 2026" />
              </Field>
            </div>
          </div>

          {/* Editable letter body */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5">
              <span className="text-xs font-medium text-slate-500">Draft — edit as needed</span>
              <div className="flex gap-2">
                <button
                  onClick={copy}
                  className="rounded-md px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={downloadPdf}
                  disabled={!letter.trim()}
                  className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                >
                  Download PDF
                </button>
              </div>
            </div>
            <textarea
              className="block w-full resize-y bg-transparent px-6 py-5 text-sm leading-relaxed text-slate-700 outline-none"
              style={{ minHeight: "20rem" }}
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
