"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AuthUser { id: number; name: string; email: string; hasAnthropicToken: boolean }
interface Resume {
  id: number;
  name: string;
  content: string;
  file_name: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export function ProfileView() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
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

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json())
      .then((d: { user?: AuthUser | null }) => setUser(d.user ?? null))
      .catch(() => setUser(null));
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
    <div className="space-y-8">
      {/* Account */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Account</h2>
        {user === undefined ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : user ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                user.hasAnthropicToken
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${user.hasAnthropicToken ? "bg-emerald-500" : "bg-amber-400"}`} />
                {user.hasAnthropicToken ? "Claude connected" : "No Claude token"}
              </span>
              <form action="/api/auth/logout" method="POST">
                <button className="text-xs text-slate-400 hover:text-slate-600">Sign out</button>
              </form>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-xs text-slate-500">
              Sign in with Google to save your data and track your job search.
            </p>
            <a
              href="/api/auth/login"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/></svg>
              Sign in with Google
            </a>
          </div>
        )}
      </section>

      {/* Claude AI Connection */}
      {user && (
        <ClaudeConnection connected={user.hasAnthropicToken} onUpdate={() => {
          fetch("/api/auth/me").then(r => r.json())
            .then((d: { user?: AuthUser | null }) => setUser(d.user ?? null))
            .catch(() => {});
        }} />
      )}

      {/* Chrome Extension */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Chrome Extension</h2>
        <p className="mb-3 text-xs text-slate-500">
          Clip job postings from any page directly into your tracker. The extension opens in
          Chrome&apos;s side panel so it stays open while you browse.
        </p>
        <div className="flex items-center gap-3">
          <a
            href="/chrome-extension.zip"
            className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Download Extension
          </a>
          <span className="text-xs text-slate-400">
            Unzip, then load in chrome://extensions with Developer Mode on.
          </span>
        </div>
      </section>

      {/* Resumes */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Resumes</h2>
            <p className="text-xs text-slate-400">Manage multiple resumes for different job types. Select which to use when analyzing or writing.</p>
          </div>
          {!adding && (
            <button onClick={() => setAdding(true)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">
              Add Resume
            </button>
          )}
        </div>

        {adding && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. General, Design Lead, IC Focus" />
            </div>
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">Content</label>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] font-medium text-brand hover:underline">Upload PDF / text file</button>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.docx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], setNewContent, setNewName)} />
              </div>
              <textarea className="input h-48 resize-y font-mono text-xs leading-relaxed" value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Paste your resume text, or upload a file above." />
            </div>
            <div className="flex gap-2">
              <button onClick={saveNew} disabled={!newContent.trim() || saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{saving ? "Saving…" : "Save Resume"}</button>
              <button onClick={() => { setAdding(false); setNewName(""); setNewContent(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : resumes.length === 0 && !adding ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center">
            <p className="text-sm text-slate-500">No resumes yet.</p>
            <p className="mt-1 text-xs text-slate-400">Add a resume to use it for matching and cover letters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resumes.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white">
                {editingId === r.id ? (
                  <div className="p-4">
                    <div className="mb-3">
                      <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
                      <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="mb-3">
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-600">Content</label>
                        <button type="button" onClick={() => editFileRef.current?.click()} className="text-[11px] font-medium text-brand hover:underline">Re-upload</button>
                        <input ref={editFileRef} type="file" accept=".pdf,.txt,.md,.docx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], setEditContent)} />
                      </div>
                      <textarea className="input h-48 resize-y font-mono text-xs leading-relaxed" value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
                      <button onClick={() => setEditingId(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-slate-800">{r.name}</h3>
                        {r.is_default === 1 && (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">Default</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {r.content.length.toLocaleString()} chars
                        {" · Updated "}
                        {new Date(r.updated_at.replace(" ", "T")).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">{r.content.slice(0, 200)}</p>
                    </div>
                    <div className="ml-4 flex shrink-0 gap-1">
                      {r.is_default !== 1 && (
                        <button onClick={() => setDefault(r.id)} className="rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50">Set default</button>
                      )}
                      <button onClick={() => { setEditingId(r.id); setEditName(r.name); setEditContent(r.content); }} className="rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50">Edit</button>
                      <button onClick={() => deleteResume(r.id)} className="rounded px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-50">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ClaudeConnection({ connected, onUpdate }: { connected: boolean; onUpdate: () => void }) {
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
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Claude AI</h2>
      <p className="mb-3 text-xs text-slate-500">
        Connect your Anthropic account to enable AI features: cover letter generation,
        resume rewriting, and smart field extraction. Uses your Max/Pro subscription credits.
      </p>

      {connected && !editing ? (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
          <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-slate-600">
            Update
          </button>
          {msg && <span className="text-xs text-emerald-600">{msg}</span>}
        </div>
      ) : !editing ? (
        <div>
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Connect Claude
          </button>
          {msg && <span className="ml-3 text-xs text-emerald-600">{msg}</span>}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="password"
            className="input font-mono text-xs"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-api03-..."
            autoFocus
          />
          <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500 space-y-1">
            <p>
              <strong>API key</strong> — create at{" "}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                console.anthropic.com/settings/keys
              </a>
            </p>
            <p>
              <strong>Max/Pro subscribers</strong> — run in terminal:
            </p>
            <p>
              1. <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px] select-all">ant auth login</code>
            </p>
            <p>
              2. <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px] select-all">ant auth print-credentials --access-token</code>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={!key.trim() || saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setKey(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
