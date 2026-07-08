"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Code } from "@astryxdesign/core/Code";
import { Link } from "@astryxdesign/core/Link";

type ClaudeStatus = "connected" | "expired" | "none";
interface AuthUser { id: number; name: string; email: string; claudeStatus: ClaudeStatus }
interface Resume {
  id: number;
  name: string;
  content: string;
  file_name: string;
  is_default: number;
  tags: string;
  created_at: string;
  updated_at: string;
}

interface ProfileViewProps {
  initialUser: AuthUser | null;
  initialAutofillFields: Record<string, unknown>;
}

export function ProfileView({ initialUser, initialAutofillFields }: ProfileViewProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [profileTab, setProfileTab] = useState<"account" | "ai" | "extension" | "resumes">("account");

  const refetchUser = useCallback(() => {
    fetch("/api/auth/me").then(r => r.json())
      .then((d: { user?: AuthUser | null }) => setUser(d.user ?? null))
      .catch(() => {});
  }, []);

  const fetchResumes = useCallback(async () => {
    const res = await fetch("/api/resumes");
    const data = await res.json();
    setResumes(data.resumes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchResumes(); }, [fetchResumes]);

  const handleFile = async (
    file: File | undefined,
    setContent: (s: string) => void,
    setName?: (s: string) => void,
  ) => {
    if (!file) return;
    if (file.type === "application/pdf") {
      const { extractFileText } = await import("@/lib/extract");
      const { text } = await extractFileText(file);
      setContent(text);
    } else {
      setContent(await file.text());
    }
    if (setName && !newName) setName(file.name.replace(/\.[^.]+$/, ""));
  };

  const saveNew = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    const isFirst = resumes.length === 0;
    await fetch("/api/resumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName || "Untitled Resume", content: newContent, is_default: isFirst }),
    });
    setAdding(false); setNewName(""); setNewContent(""); setSaving(false);
    fetchResumes();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    await fetch(`/api/resumes/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, content: editContent }),
    });
    setEditingId(null); setSaving(false); fetchResumes();
  };

  const setDefault = async (id: number) => {
    await fetch(`/api/resumes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_default: true }) });
    fetchResumes();
  };

  const deleteResume = async (id: number) => {
    if (!confirm("Delete this resume?")) return;
    await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    fetchResumes();
  };

  return (
    <Stack gap={6}>
      <div className="flex justify-center">
        <TabList value={profileTab} onChange={(v) => setProfileTab(v as typeof profileTab)}>
          <Tab value="account" label="Account" />
          <Tab value="ai" label="AI" />
          <Tab value="extension" label="Extension" />
          <Tab value="resumes" label="Resumes" />
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
                <Button label="Sign out of Google" variant="ghost" size="sm" />
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

      <ApplicationFields initialFields={initialAutofillFields} />
      </>}

      {profileTab === "ai" && <>
      {user && (
        <ClaudeConnection status={user.claudeStatus} onUpdate={() => {
          refetchUser();
        }} />
      )}
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

          {adding && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3">
                <TextInput label="Name" value={newName} onChange={setNewName} placeholder="e.g. General, Design Lead, IC Focus" />
              </div>
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <Text type="supporting" weight="semibold">Content</Text>
                  <Button label="Upload PDF / text file" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} />
                  <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.docx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], setNewContent, setNewName)} />
                </div>
                <TextArea label="Content" isLabelHidden value={newContent} onChange={setNewContent} placeholder="Paste your resume text, or upload a file above." rows={10} />
              </div>
              <HStack gap={2}>
                <Button label={saving ? "Saving…" : "Save Resume"} variant="primary" onClick={saveNew} isDisabled={!newContent.trim() || saving} />
                <Button label="Cancel" variant="secondary" onClick={() => { setAdding(false); setNewName(""); setNewContent(""); }} />
              </HStack>
            </div>
          )}

          {loading ? (
            <Text type="supporting" className="py-8 text-center">Loading…</Text>
          ) : resumes.length === 0 && !adding ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center">
              <Text display="block">No resumes yet.</Text>
              <Text type="supporting" display="block" className="mt-1">Add a resume to use it for matching and cover letters.</Text>
            </div>
          ) : (
            <Stack gap={3}>
              {resumes.map((r) => (
                <Card key={r.id}>
                  {editingId === r.id ? (
                    <div className="p-4">
                      <div className="mb-3">
                        <TextInput label="Name" value={editName} onChange={setEditName} />
                      </div>
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between">
                          <Text type="supporting" weight="semibold">Content</Text>
                          <Button label="Re-upload" variant="ghost" size="sm" onClick={() => editFileRef.current?.click()} />
                          <input ref={editFileRef} type="file" accept=".pdf,.txt,.md,.docx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], setEditContent)} />
                        </div>
                        <TextArea label="Content" isLabelHidden value={editContent} onChange={setEditContent} rows={10} />
                      </div>
                      <HStack gap={2}>
                        <Button label={saving ? "Saving…" : "Save"} variant="primary" onClick={saveEdit} isDisabled={saving} />
                        <Button label="Cancel" variant="secondary" onClick={() => setEditingId(null)} />
                      </HStack>
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
                          {new Date(r.updated_at.replace(" ", "T")).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
    </Stack>
  );
}

function ClaudeConnection({ status, onUpdate }: { status: ClaudeStatus; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/auth/connect-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setEditing(false);
      setKey("");
      setMsg("Connected!");
      onUpdate();
    } catch {
      setMsg("Failed to save key.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="p-5">
        <Text type="label" display="block" className="mb-3">Claude AI</Text>
        <Text type="supporting" display="block" className="mb-3">
          Connect your Anthropic account to enable AI features: cover letter generation,
          resume rewriting, and smart field extraction. Uses your Max/Pro subscription credits.
        </Text>

        {status === "connected" && !editing ? (
          <HStack gap={3} className="items-center">
            <Badge label="Connected" variant="success" />
            <Button label="Update" variant="ghost" size="sm" onClick={() => setEditing(true)} />
            {msg && <Text type="supporting" className="text-emerald-600">{msg}</Text>}
          </HStack>
        ) : status === "expired" && !editing ? (
          <HStack gap={3} className="items-center">
            <Badge label="Expired" variant="warning" />
            <Button label="Reconnect" variant="primary" size="sm" onClick={() => setEditing(true)} />
            {msg && <Text type="supporting" className="text-emerald-600">{msg}</Text>}
          </HStack>
        ) : !editing ? (
          <HStack gap={3} className="items-center">
            <Button label="Connect Claude" variant="primary" onClick={() => setEditing(true)} />
            {msg && <Text type="supporting" className="text-emerald-600">{msg}</Text>}
          </HStack>
        ) : (
          <Stack gap={2}>
            <TextInput
              label="API Key"
              isLabelHidden
              value={key}
              onChange={setKey}
              placeholder="sk-ant-api03-..."
            />
            <Card className="p-3">
              <Stack gap={1}>
                <Text type="supporting" display="block">
                  <Text type="supporting" weight="semibold">API key</Text> — create at{" "}
                  <Link href="https://console.anthropic.com/settings/keys" isExternalLink>
                    console.anthropic.com/settings/keys
                  </Link>
                </Text>
                <Text type="supporting" display="block">
                  <Text type="supporting" weight="semibold">Max/Pro subscribers</Text> — run in terminal:
                </Text>
                <Text type="supporting" display="block">1. <Code>ant auth login</Code></Text>
                <Text type="supporting" display="block">2. <Code>ant auth print-credentials --access-token</Code></Text>
              </Stack>
            </Card>
            <HStack gap={2}>
              <Button label={saving ? "Saving…" : "Save"} variant="primary" onClick={save} isDisabled={!key.trim() || saving} />
              <Button label="Cancel" variant="secondary" onClick={() => { setEditing(false); setKey(""); }} />
            </HStack>
          </Stack>
        )}
      </div>
    </Card>
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
      const res = await fetch("/api/profile/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error();
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
          {msg && <Text type="supporting" className="text-emerald-600">{msg}</Text>}
        </HStack>
      </div>
    </Card>
  );
}
