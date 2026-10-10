"use client";

import { useConfirm } from "@/hooks/useConfirm";
import { useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { Stack } from "@astryxdesign/core/Stack";
import { HStack } from "@astryxdesign/core/HStack";
import { Banner } from "@astryxdesign/core/Banner";
import { readResumeFile } from "@/lib/extract";
import { formatDate } from "@/lib/format";
import { apiSend, errorMessage } from "@/lib/api-client";
import { useResumes } from "@/hooks/useResumes";
import type { ClaudeStatus } from "@/lib/anthropic";
import { CandidateProfilePanel } from "./CandidateProfilePanel";
import { AIProvidersPanel } from "./AIProvidersPanel";
import { McpConnectPanel } from "./McpConnectPanel";
import { OnboardingWizardModal } from "./OnboardingWizardModal";

interface AuthUser { id: number; name: string; email: string; claudeStatus: ClaudeStatus }

interface ProfileViewProps {
  initialUser: AuthUser | null;
  initialAutofillFields: Record<string, unknown>;
}

export function ProfileView({ initialUser, initialAutofillFields }: ProfileViewProps) {
  const [user] = useState<AuthUser | null>(initialUser);
  const { resumes, loading, refetch: fetchResumes } = useResumes();
  const { confirm, dialog } = useConfirm();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [profileTab, setProfileTab] = useState<"account" | "ai" | "extension" | "resumes" | "candidate">("account");

  const handleFile = async (
    file: File | undefined,
    setContent: (s: string) => void,
    setName?: (s: string) => void,
  ) => {
    if (!file) return;
    setResumeError(null);
    try {
      const { text, name } = await readResumeFile(file);
      setContent(text);
      if (setName && !newName) setName(name);
    } catch (err) {
      setResumeError(errorMessage(err, `Couldn't read ${file.name}.`));
    }
  };

  // Runs a resume write then reloads the list; on failure the error shows and
  // any open form stays open with its contents.
  const writeResumes = async (write: () => Promise<unknown>, fallback: string): Promise<boolean> => {
    setResumeError(null);
    try {
      await write();
    } catch (err) {
      setResumeError(errorMessage(err, fallback));
      return false;
    }
    await fetchResumes().catch(() => {});
    return true;
  };

  const saveNew = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    const isFirst = resumes.length === 0;
    const ok = await writeResumes(
      () => apiSend("/api/resumes", "POST", { name: newName || "Untitled Resume", content: newContent, is_default: isFirst }),
      "Could not save the resume.",
    );
    setSaving(false);
    if (ok) { setAdding(false); setNewName(""); setNewContent(""); }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const ok = await writeResumes(
      () => apiSend(`/api/resumes/${editingId}`, "PATCH", { name: editName, content: editContent }),
      "Could not save the resume.",
    );
    setSaving(false);
    if (ok) setEditingId(null);
  };

  const setDefault = (id: number) =>
    writeResumes(() => apiSend(`/api/resumes/${id}`, "PATCH", { is_default: true }), "Could not set the default resume.");

  const deleteResume = async (id: number) => {
    if (!(await confirm({ title: "Delete this resume?", description: "It's removed from your profile. Jobs keep the reports already run against it.", actionLabel: "Delete" }))) return;
    await writeResumes(() => apiSend(`/api/resumes/${id}`, "DELETE"), "Could not delete the resume.");
  };

  return (
    <Stack gap={6}>
      <div className="flex justify-center">
        <TabList value={profileTab} onChange={(v) => setProfileTab(v as typeof profileTab)}>
          <Tab value="account" label="Account" />
          <Tab value="ai" label="AI" />
          <Tab value="extension" label="Extension" />
          <Tab value="resumes" label="Resumes" />
          <Tab value="candidate" label="Candidate Profile" />
        </TabList>
      </div>

      {profileTab === "account" && <>
      <Card>
        <div className="p-5">
          <Text type="label" display="block" className="mb-3">Account</Text>
          {user ? (
            <div className="flex items-center justify-between">
              <div>
                <Text weight="semibold" display="block">{user.name}</Text>
                <Text type="supporting" display="block">{user.email}</Text>
              </div>
              <form action="/api/auth/logout" method="POST">
                <Button type="submit" label="Sign out of Google" variant="ghost" size="sm" />
              </form>
            </div>
          ) : (
            <div>
              <Text type="supporting" display="block" className="mb-3">
                Sign in with Google to save your data and track your job search.
              </Text>
              <Button
                label="Sign in with Google"
                variant="secondary"
                href="/api/auth/login"
                icon={
                  <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/></svg>
                }
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-5">
          <Text type="label" display="block" className="mb-1">Help & Workflow Tour</Text>
          <Text type="supporting" display="block" className="mb-3">
            Review the complete onboarding guide covering job capturing, candidate profiles, fitness scoring, and resume tailoring.
          </Text>
          <Button
            label="Launch Onboarding Wizard"
            variant="secondary"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent("open-onboarding-wizard"))}
          />
        </div>
      </Card>

      <ApplicationFields initialFields={initialAutofillFields} />
      </>}

      {profileTab === "ai" && <>
        <AIProvidersPanel />
        <McpConnectPanel />
      </>}

      {profileTab === "extension" && <>
      <Card>
        <div className="p-5">
          <Text type="label" display="block" className="mb-3">Chrome Extension</Text>
          <Text type="supporting" display="block" className="mb-3">
            Clip job postings from any page directly into your tracker. The extension opens in
            Chrome&apos;s side panel so it stays open while you browse.
          </Text>
          <HStack gap={3} className="items-center">
            <Button label="Download Extension" variant="primary" href="/chrome-extension.zip" />
            <Text type="supporting">
              Unzip, then load in chrome://extensions with Developer Mode on.
            </Text>
          </HStack>
        </div>
      </Card>
      </>}

      {profileTab === "candidate" && <CandidateProfilePanel />}

      {profileTab === "resumes" && <>
      <Card>
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <Text type="label" display="block">Resumes</Text>
              <Text type="supporting" display="block">Manage multiple resumes for different job types. Select which to use when analyzing or writing.</Text>
            </div>
            {!adding && (
              <Button label="Add Resume" variant="primary" size="sm" onClick={() => setAdding(true)} />
            )}
          </div>

          {resumeError && (
            <div className="mb-4">
              <Banner status="error" title={resumeError} isDismissable onDismiss={() => setResumeError(null)} />
            </div>
          )}

          {adding && (
            <div className="mb-4 rounded-lg border border-border bg-muted p-4">
              <div className="mb-3 flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <TextInput label="Name" value={newName} onChange={setNewName} placeholder="e.g. General, Design Lead, IC Focus" />
                </div>
                <HStack gap={2} className="shrink-0">
                  <Button label="Cancel" variant="secondary" onClick={() => { setAdding(false); setNewName(""); setNewContent(""); setResumeError(null); }} />
                  <Button label={saving ? "Saving…" : "Save Resume"} variant="primary" onClick={saveNew} isDisabled={!newContent.trim() || saving} />
                </HStack>
              </div>
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <Text type="supporting" weight="semibold">Content</Text>
                  <Button label="Upload PDF / text file" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} />
                  <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.docx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], setNewContent, setNewName)} />
                </div>
                <TextArea label="Content" isLabelHidden value={newContent} onChange={setNewContent} placeholder="Paste your resume text, or upload a file above." rows={10} />
              </div>
            </div>
          )}

          {loading ? (
            <Text type="supporting" className="py-8 text-center">Loading…</Text>
          ) : resumes.length === 0 && !adding ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center">
              <Text display="block">No resumes yet.</Text>
              <Text type="supporting" display="block" className="mt-1">Add a resume to use it for matching and cover letters.</Text>
            </div>
          ) : (
            <Stack gap={3}>
              {resumes.map((r) => (
                <Card key={r.id}>
                  {editingId === r.id ? (
                    <div className="p-4">
                      <div className="mb-3 flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                          <TextInput label="Name" value={editName} onChange={setEditName} />
                        </div>
                        <HStack gap={2} className="shrink-0">
                          <Button label="Cancel" variant="secondary" onClick={() => { setEditingId(null); setResumeError(null); }} />
                          <Button label={saving ? "Saving…" : "Save"} variant="primary" onClick={saveEdit} isDisabled={saving} />
                        </HStack>
                      </div>
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between">
                          <Text type="supporting" weight="semibold">Content</Text>
                          <Button label="Re-upload" variant="ghost" size="sm" onClick={() => editFileRef.current?.click()} />
                          <input ref={editFileRef} type="file" accept=".pdf,.txt,.md,.docx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], setEditContent)} />
                        </div>
                        <TextArea label="Content" isLabelHidden value={editContent} onChange={setEditContent} rows={10} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <HStack gap={2} className="items-center">
                          <Text weight="semibold">{r.name}</Text>
                          {r.is_default === 1 && (
                            <Badge label="Default" variant="success" />
                          )}
                        </HStack>
                        <Text type="supporting" className="mt-1">
                          {r.content.length.toLocaleString()} chars
                          {" · Updated "}
                          {formatDate(r.updated_at)}
                        </Text>
                        {(() => {
                          const tags: string[] = (() => { try { return JSON.parse(r.tags || "[]"); } catch { return []; } })();
                          return tags.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {tags.map((t) => (
                                <Badge key={t} label={t} variant="neutral" />
                              ))}
                            </div>
                          ) : null;
                        })()}
                        <Text type="supporting" className="mt-2 line-clamp-2">{r.content.slice(0, 200)}</Text>
                      </div>
                      <HStack gap={1} className="ml-4 shrink-0">
                        {r.is_default !== 1 && (
                          <Button label="Set default" variant="ghost" size="sm" onClick={() => setDefault(r.id)} />
                        )}
                        <Button label="Edit" variant="ghost" size="sm" onClick={() => { setEditingId(r.id); setEditName(r.name); setEditContent(r.content); }} />
                        <Button label="Delete" variant="destructive" size="sm" onClick={() => deleteResume(r.id)} />
                      </HStack>
                    </div>
                  )}
                </Card>
              ))}
            </Stack>
          )}
        </div>
      </Card>
      </>}

      <OnboardingWizardModal />
      {dialog}
    </Stack>
  );
}

const PROFILE_FIELDS: { key: string; label: string; type?: "checkbox"; half?: boolean }[] = [
  { key: "first_name", label: "First name", half: true },
  { key: "last_name", label: "Last name", half: true },
  { key: "email", label: "Email", half: true },
  { key: "phone", label: "Phone", half: true },
  { key: "address", label: "Address" },
  { key: "city", label: "City", half: true },
  { key: "state", label: "State", half: true },
  { key: "current_title", label: "Current title", half: true },
  { key: "current_company", label: "Current company", half: true },
  { key: "linkedin", label: "LinkedIn URL" },
  { key: "github", label: "GitHub URL", half: true },
  { key: "website", label: "Website / Portfolio", half: true },
  { key: "substack", label: "Substack / Blog" },
];

function fieldsFromAutofill(d: Record<string, unknown>): Record<string, string | boolean> {
  const f: Record<string, string | boolean> = {};
  for (const pf of PROFILE_FIELDS) {
    const v = d[pf.key];
    f[pf.key] = pf.type === "checkbox" ? !!v : String(v ?? "");
  }
  return f;
}

function ApplicationFields({ initialFields }: { initialFields: Record<string, unknown> }) {
  const [fields, setFields] = useState<Record<string, string | boolean>>(() => fieldsFromAutofill(initialFields));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      await apiSend("/api/profile/autofill", "POST", fields);
      setMsg("Saved!");
      setTimeout(() => setMsg(""), 2000);
    } catch {
      setMsg("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="p-5">
        <Text type="label" display="block" className="mb-1">Application Fields</Text>
        <Text type="supporting" display="block" className="mb-4">
          Used by the extension to auto-fill job applications and shown in the Fill tab for quick copying.
        </Text>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PROFILE_FIELDS.map((pf) => (
            <div key={pf.key} className={pf.half ? "" : "sm:col-span-2"}>
              {pf.type === "checkbox" ? (
                <Switch
                  label={pf.label}
                  value={!!fields[pf.key]}
                  onChange={(checked) => setFields((p) => ({ ...p, [pf.key]: checked }))}
                />
              ) : (
                <TextInput
                  label={pf.label}
                  value={String(fields[pf.key] ?? "")}
                  onChange={(v) => setFields((p) => ({ ...p, [pf.key]: v }))}
                />
              )}
            </div>
          ))}
        </div>
        <HStack gap={3} className="mt-4 items-center">
          <Button label={saving ? "Saving…" : "Save"} variant="primary" size="sm" onClick={save} isDisabled={saving} />
          {msg && <Text type="supporting" className="text-emerald-700 dark:text-emerald-400">{msg}</Text>}
        </HStack>
      </div>
    </Card>
  );
}
