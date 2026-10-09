"use client";

import { useEffect, useState } from "react";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";
import { HStack } from "@astryxdesign/core/Stack";
import { Link } from "@astryxdesign/core/Link";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Banner } from "@astryxdesign/core/Banner";
import type { AIProviderId } from "@/lib/ai";

interface ProviderConfig {
  id: AIProviderId;
  name: string;
  badgeName: string;
  description: string;
  defaultModel: string;
  availableModels: string[];
  helpUrl: string;
  placeholder: string;
  isConfigured: boolean;
  isActive: boolean;
  model: string;
  maskedKey: string | null;
}

export function AIProvidersPanel() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<AIProviderId | null>(null);
  const [inputKey, setInputKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/ai/providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers ?? []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    fetch("/api/ai/providers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.providers) setProviders(data.providers);
        if (!ignore) setLoading(false);
      })
      .catch(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleSave = async (providerId: AIProviderId) => {
    if (!inputKey.trim()) return;
    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          apiKey: inputKey.trim(),
          model: selectedModel || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save key");
      }

      setStatusMsg({ type: "success", text: data.message ?? "Provider connected!" });
      setEditingId(null);
      setInputKey("");
      await fetchProviders();
      window.dispatchEvent(new Event("auth-change"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect provider";
      setStatusMsg({ type: "error", text: message });
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (providerId: AIProviderId) => {
    try {
      const res = await fetch("/api/ai/providers/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });
      if (res.ok) {
        await fetchProviders();
        window.dispatchEvent(new Event("auth-change"));
      }
    } catch {}
  };

  const handleDelete = async (providerId: AIProviderId) => {
    if (!confirm(`Disconnect ${providerId.toUpperCase()} API key?`)) return;
    try {
      const res = await fetch(`/api/ai/providers/${providerId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchProviders();
        window.dispatchEvent(new Event("auth-change"));
      }
    } catch {}
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center p-8">
          <Spinner label="Loading AI providers…" />
        </div>
      </Card>
    );
  }

  const hasActive = providers.some((p) => p.isActive && p.isConfigured);

  const startEditing = (p: ProviderConfig) => {
    setEditingId(p.id);
    setInputKey("");
    setSelectedModel(p.isConfigured ? p.model : p.defaultModel);
    setStatusMsg(null);
  };

  return (
    <Card>
      <div className="p-5">
        <Text type="label" display="block" className="mb-1">AI Providers &amp; Keys</Text>
        <Text type="supporting" display="block" className="mb-3">
          API keys for in-app AI: cover letters, resume rewrites, fitness checks, and parsing.
          {!hasActive && " Connect one to unlock AI tools."}
        </Text>

        {statusMsg && (
          <div className="mb-3">
            <Banner
              status={statusMsg.type === "success" ? "success" : "error"}
              title={statusMsg.text}
              isDismissable
              onDismiss={() => setStatusMsg(null)}
            />
          </div>
        )}

        <div className="divide-y divide-border rounded-md border border-border">
          {providers.map((p) => {
            const isEditing = editingId === p.id;
            const isActive = p.isActive && p.isConfigured;

            return (
              <div key={p.id} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <HStack gap={2} className="items-center">
                      <Text weight="semibold">{p.name}</Text>
                      {p.isConfigured && (
                        <Badge variant={isActive ? "success" : "neutral"} label={isActive ? "Active" : "Connected"} />
                      )}
                    </HStack>
                    <Text type="supporting" display="block" className="truncate">
                      {p.isConfigured ? (
                        <code className="text-xs">{p.maskedKey} · {p.model}</code>
                      ) : (
                        p.description
                      )}
                    </Text>
                  </div>

                  {!isEditing && (
                    <HStack gap={1} className="shrink-0">
                      {p.isConfigured ? (
                        <>
                          {!isActive && (
                            <Button label="Set Active" variant="ghost" size="sm" onClick={() => handleSetActive(p.id)} />
                          )}
                          <Button label="Update" variant="ghost" size="sm" onClick={() => startEditing(p)} />
                          <Button label="Disconnect" variant="ghost" size="sm" onClick={() => handleDelete(p.id)} />
                        </>
                      ) : (
                        <Button label="Connect" variant="secondary" size="sm" onClick={() => startEditing(p)} />
                      )}
                    </HStack>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="min-w-[16rem] flex-1">
                      <TextInput
                        label="API Key"
                        value={inputKey}
                        onChange={setInputKey}
                        placeholder={p.placeholder}
                        onEnter={() => handleSave(p.id)}
                      />
                    </div>
                    {p.availableModels.length > 1 && (
                      <div className="min-w-[12rem]">
                        <Selector
                          label="Model"
                          options={p.availableModels.map((m) => ({ value: m, label: m }))}
                          value={selectedModel || p.model}
                          onChange={(v) => setSelectedModel(v as string)}
                        />
                      </div>
                    )}
                    <HStack gap={2}>
                      <Button
                        label={saving ? "Validating…" : "Save"}
                        variant="primary"
                        size="sm"
                        onClick={() => handleSave(p.id)}
                        isDisabled={!inputKey.trim() || saving}
                      />
                      <Button
                        label="Cancel"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          setInputKey("");
                          setStatusMsg(null);
                        }}
                      />
                    </HStack>
                    <div className="w-full text-xs text-secondary">
                      Get a key at{" "}
                      <Link href={p.helpUrl} isExternalLink>
                        {new URL(p.helpUrl).hostname}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
