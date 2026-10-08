"use client";

import { useEffect, useState } from "react";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";
import { Stack, HStack } from "@astryxdesign/core/Stack";
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
        <div className="flex items-center justify-center p-12">
          <Spinner label="Loading AI providers…" />
        </div>
      </Card>
    );
  }

  const activeProvider = providers.find((p) => p.isActive && p.isConfigured);

  return (
    <Stack gap={5}>
      <Card>
        <div className="p-5">
          <Text type="label" display="block" className="mb-1">AI Providers & Keys</Text>
          <Text type="supporting" display="block" className="mb-4">
            Connect one or more API keys to power AI features: cover letter generation, resume rewriting,
            fitness checks, and smart parsing. Choose your active default provider below.
          </Text>

          {activeProvider ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
              <HStack gap={2} className="items-center">
                <Badge variant="success" label="Active Provider" />
                <Text weight="semibold">{activeProvider.name}</Text>
                <Text type="supporting">({activeProvider.model})</Text>
              </HStack>
            </div>
          ) : (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <Text type="supporting">
                No active provider connected. Connect at least one API key below to unlock AI tools.
              </Text>
            </div>
          )}
        </div>
      </Card>

      {statusMsg && (
        <Banner
          status={statusMsg.type === "success" ? "success" : "error"}
          title={statusMsg.text}
          isDismissable
          onDismiss={() => setStatusMsg(null)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {providers.map((p) => {
          const isEditing = editingId === p.id;

          return (
            <Card key={p.id} className={`transition ${p.isActive && p.isConfigured ? "ring-2 ring-accent" : ""}`}>
              <div className="flex h-full flex-col justify-between p-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <HStack gap={2} className="items-center">
                      <Text weight="semibold" type="label">{p.name}</Text>
                      {p.isConfigured && (
                        <Badge
                          variant={p.isActive ? "success" : "neutral"}
                          label={p.isActive ? "Active Default" : "Connected"}
                        />
                      )}
                    </HStack>

                    {p.isConfigured && !p.isActive && !isEditing && (
                      <Button
                        label="Set Active"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetActive(p.id)}
                      />
                    )}
                  </div>

                  <Text type="supporting" display="block" className="mb-4">
                    {p.description}
                  </Text>

                  {p.isConfigured && !isEditing ? (
                    <div className="mb-4 space-y-2 rounded-md border border-border bg-surface p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <Text type="supporting">Key:</Text>
                        <code className="text-xs">{p.maskedKey}</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <Text type="supporting">Default Model:</Text>
                        <code className="text-xs">{p.model}</code>
                      </div>
                    </div>
                  ) : isEditing ? (
                    <Stack gap={3} className="mb-4">
                      <div>
                        <TextInput
                          label="API Key"
                          value={inputKey}
                          onChange={setInputKey}
                          placeholder={p.placeholder}
                        />
                      </div>

                      {p.availableModels.length > 1 && (
                        <div>
                          <Selector
                            label="Model"
                            options={p.availableModels.map((m) => ({ value: m, label: m }))}
                            value={selectedModel || p.model}
                            onChange={(v) => setSelectedModel(v as string)}
                          />
                        </div>
                      )}

                      <div className="text-xs text-secondary">
                        Get your API key at{" "}
                        <Link href={p.helpUrl} isExternalLink>
                          {new URL(p.helpUrl).hostname}
                        </Link>
                      </div>
                    </Stack>
                  ) : null}
                </div>

                <div>
                  {isEditing ? (
                    <HStack gap={2}>
                      <Button
                        label={saving ? "Validating…" : "Save & Connect"}
                        variant="primary"
                        size="sm"
                        onClick={() => handleSave(p.id)}
                        isDisabled={!inputKey.trim() || saving}
                      />
                      <Button
                        label="Cancel"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          setInputKey("");
                          setStatusMsg(null);
                        }}
                      />
                    </HStack>
                  ) : p.isConfigured ? (
                    <HStack gap={2}>
                      <Button
                        label="Update Key"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingId(p.id);
                          setInputKey("");
                          setSelectedModel(p.model);
                          setStatusMsg(null);
                        }}
                      />
                      <Button
                        label="Disconnect"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(p.id)}
                      />
                    </HStack>
                  ) : (
                    <Button
                      label={`Connect ${p.badgeName}`}
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingId(p.id);
                        setInputKey("");
                        setSelectedModel(p.defaultModel);
                        setStatusMsg(null);
                      }}
                    />
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Stack>
  );
}
