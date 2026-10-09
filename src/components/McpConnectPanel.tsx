"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Stack, HStack } from "@astryxdesign/core/Stack";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Spinner } from "@astryxdesign/core/Spinner";
import { formatDate } from "@/lib/format";

interface ApiToken {
  id: number;
  label: string;
  created_at: string;
  last_used_at: string | null;
}

interface McpSettings {
  url: string;
  last_used_at: string | null;
  tokens: ApiToken[];
}

/**
 * Profile → AI: connect Claude to this job search over MCP. Connectors sign in
 * through the app (OAuth), so the URL itself is safe to share; personal access
 * tokens are the fallback for scripts and clients that can't do the sign-in.
 */
export function McpConnectPanel() {
  const [settings, setSettings] = useState<McpSettings | null>(null);
  const [label, setLabel] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/mcp-settings");
    if (res.ok) setSettings(await res.json());
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/mcp-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((d: McpSettings | null) => { if (!ignore && d) setSettings(d); })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  const act = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return null;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mcp-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      await load();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createToken = async () => {
    const data = await act({ action: "create_token", label: label.trim() });
    if (data?.token) {
      setNewToken(data.token);
      setLabel("");
    }
  };

  if (!settings) {
    return (
      <Card>
        <div className="flex items-center justify-center p-12">
          <Spinner label="Loading MCP settings…" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-5">
        <HStack gap={2} className="mb-1 items-center">
          <Text type="label">Connect Claude (MCP)</Text>
          {settings.last_used_at && <Badge variant="success" label={`Last used ${formatDate(settings.last_used_at)}`} />}
        </HStack>
        <Text type="supporting" display="block" className="mb-4">
          Give Claude direct access to your job search — pipeline, resumes, candidate profile, ATS
          match and fitness checks — from claude.ai, the Claude apps, or Claude Code. Claude runs
          on your Claude plan; no API key needed here.
        </Text>

        <Stack gap={4}>
          <div>
            <Text type="supporting" display="block" className="mb-1">MCP server URL</Text>
            <CodeBlock code={settings.url} hasCopyButton isWrapped width="100%" size="sm" />
          </div>

          <div>
            <Text weight="semibold" display="block" className="mb-1">claude.ai, Claude Desktop &amp; mobile</Text>
            <Text type="supporting" display="block">
              Settings → Connectors → Add custom connector. Name it &ldquo;Job Search&rdquo;, paste the
              URL, then sign in with Google and allow access when prompted.
            </Text>
          </div>

          <div>
            <Text weight="semibold" display="block" className="mb-1">Claude Code</Text>
            <CodeBlock
              code={`claude mcp add --transport http jobsearch ${settings.url}`}
              language="bash"
              hasLanguageLabel={false}
              hasCopyButton
              isWrapped
              width="100%"
              size="sm"
            />
            <Text type="supporting" display="block" className="mt-1">
              Then run <code className="text-xs">/mcp</code> in Claude Code and choose Authenticate.
            </Text>
          </div>

          <div>
            <Button
              label="Disconnect all connected apps"
              variant="ghost"
              size="sm"
              isDisabled={busy}
              onClick={() => act(
                { action: "disconnect_clients" },
                "Sign out every connected Claude app? Each will need to sign in again. Access tokens below are not affected.",
              )}
            />
          </div>

          <div className="border-t border-border pt-4">
            <Text weight="semibold" display="block" className="mb-1">Access tokens</Text>
            <Text type="supporting" display="block" className="mb-3">
              For scripts and clients that can&apos;t sign in: send as{" "}
              <code className="text-xs">Authorization: Bearer &lt;token&gt;</code>. Anyone holding a
              token can read and change your job search.
            </Text>

            {newToken && (
              <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <Text type="supporting" display="block" className="mb-2">
                  Copy this token now — it won&apos;t be shown again.
                </Text>
                <CodeBlock code={newToken} hasCopyButton isWrapped width="100%" size="sm" />
              </div>
            )}

            {settings.tokens.length > 0 && (
              <div className="mb-3 divide-y divide-border rounded-md border border-border">
                {settings.tokens.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <Text weight="semibold" display="block" className="truncate">{t.label}</Text>
                      <Text type="supporting" display="block">
                        Created {formatDate(t.created_at)} ·{" "}
                        {t.last_used_at ? `last used ${formatDate(t.last_used_at)}` : "never used"}
                      </Text>
                    </div>
                    <Button
                      label="Revoke"
                      variant="ghost"
                      size="sm"
                      isDisabled={busy}
                      onClick={() => act({ action: "revoke_token", id: t.id }, `Revoke "${t.label}"? Anything using it loses access immediately.`)}
                    />
                  </div>
                ))}
              </div>
            )}

            <HStack gap={2} className="items-end">
              <div className="flex-1">
                <TextInput
                  label="Token name"
                  isLabelHidden
                  value={label}
                  onChange={setLabel}
                  placeholder="Token name, e.g. Laptop script"
                  onEnter={() => label.trim() && createToken()}
                />
              </div>
              <Button
                label="Create token"
                variant="secondary"
                size="sm"
                isDisabled={busy || !label.trim()}
                onClick={createToken}
              />
            </HStack>
          </div>
        </Stack>

        {error && <Text type="supporting" display="block" className="mt-3 text-rose-600">{error}</Text>}
      </div>
    </Card>
  );
}
