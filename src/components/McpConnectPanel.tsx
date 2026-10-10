"use client";

import { useConfirm, type ConfirmOptions } from "@/hooks/useConfirm";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { HStack } from "@astryxdesign/core/Stack";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Spinner } from "@astryxdesign/core/Spinner";
import { formatDate } from "@/lib/format";
import type { ApiTokenRow } from "@/lib/db/api-tokens";
import { apiGet, apiSend, errorMessage } from "@/lib/api-client";

interface McpSettings {
  url: string;
  last_used_at: string | null;
  tokens: ApiTokenRow[];
}

/**
 * Profile → AI: connect Claude, ChatGPT, or any MCP client to this job search. Connectors sign in
 * through the app (OAuth), so the URL itself is safe to share; personal access
 * tokens are the fallback for scripts and clients that can't do the sign-in.
 */
export function McpConnectPanel() {
  const [settings, setSettings] = useState<McpSettings | null>(null);
  const { confirm, dialog } = useConfirm();
  const [label, setLabel] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setSettings(await apiGet<McpSettings>("/api/mcp-settings"));
  }, []);

  useEffect(() => {
    let ignore = false;
    apiGet<McpSettings>("/api/mcp-settings")
      .then((d) => { if (!ignore) setSettings(d); })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  const act = async (body: Record<string, unknown>, ask?: ConfirmOptions) => {
    if (ask && !(await confirm(ask))) return null;
    setBusy(true);
    setError(null);
    try {
      const data = await apiSend<{ token?: string }>("/api/mcp-settings", "POST", body);
      await load();
      return data;
    } catch (err) {
      setError(errorMessage(err, "Request failed"));
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
        <div className="flex items-center justify-center p-8">
          <Spinner label="Loading MCP settings…" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <HStack gap={2} className="items-center">
            <Text type="label">Connect Claude &amp; ChatGPT (MCP)</Text>
            {settings.last_used_at && <Badge variant="success" label={`Last used ${formatDate(settings.last_used_at)}`} />}
          </HStack>
          <Button
            label="Disconnect all apps"
            variant="ghost"
            size="sm"
            isDisabled={busy}
            onClick={() => act(
              { action: "disconnect_clients" },
              {
                title: "Disconnect all apps?",
                description: "Every connected app (Claude, ChatGPT, …) is signed out and will need to sign in again. Access tokens are not affected.",
                actionLabel: "Disconnect",
              },
            )}
          />
        </div>
        <Text type="supporting" display="block" className="mb-3">
          Use your job search from Claude, ChatGPT, or any MCP client — on your own plan, no API key needed.
        </Text>

        <div className="divide-y divide-border rounded-md border border-border">
          <div className="px-3 py-2.5">
            <Text weight="semibold" display="block" className="mb-1.5">Server URL</Text>
            <CodeBlock code={settings.url} hasCopyButton isWrapped width="100%" size="sm" />
            <Text type="supporting" display="block" className="mt-1.5">
              <span className="font-semibold">Claude</span> (web, desktop, mobile): Settings → Connectors → Add custom
              connector, paste the URL, sign in, Allow.
            </Text>
            <Text type="supporting" display="block" className="mt-0.5">
              <span className="font-semibold">ChatGPT</span>: Settings → Apps &amp; Connectors → Advanced → turn on
              Developer mode, then Create: paste the URL, Authentication OAuth, sign in, Allow.
            </Text>
          </div>

          <div className="px-3 py-2.5">
            <Text weight="semibold" display="block" className="mb-1.5">Claude Code</Text>
            <CodeBlock
              code={`claude mcp add --transport http jobsearch ${settings.url}`}
              language="bash"
              hasLanguageLabel={false}
              hasCopyButton
              isWrapped
              width="100%"
              size="sm"
            />
            <Text type="supporting" display="block" className="mt-1.5">
              Then <code className="text-xs">/mcp</code> → Authenticate.
            </Text>
          </div>

          <div className="px-3 py-2.5">
            <Text weight="semibold" display="block">Access tokens</Text>
            <Text type="supporting" display="block" className="mb-2">
              For scripts that can&apos;t sign in, sent as <code className="text-xs">Authorization: Bearer</code>. Treat like a password.
            </Text>

            {newToken && (
              <div className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
                <Text type="supporting" display="block" className="mb-1.5">Copy it now — it won&apos;t be shown again.</Text>
                <CodeBlock code={newToken} hasCopyButton isWrapped width="100%" size="sm" />
              </div>
            )}

            {settings.tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-1">
                <Text display="block" className="min-w-0 truncate">
                  <span className="font-semibold">{t.label}</span>{" "}
                  <span className="text-secondary">
                    · created {formatDate(t.created_at)} · {t.last_used_at ? `used ${formatDate(t.last_used_at)}` : "never used"}
                  </span>
                </Text>
                <Button
                  label="Revoke"
                  variant="ghost"
                  size="sm"
                  isDisabled={busy}
                  onClick={() => act({ action: "revoke_token", id: t.id }, { title: `Revoke "${t.label}"?`, description: "Anything using it loses access immediately.", actionLabel: "Revoke" })}
                />
              </div>
            ))}

            <HStack gap={2} className="mt-1 items-center">
              <div className="flex-1">
                <TextInput
                  label="Token name"
                  isLabelHidden
                  size="sm"
                  value={label}
                  onChange={setLabel}
                  placeholder="New token name, e.g. Laptop script"
                  onEnter={() => label.trim() && createToken()}
                />
              </div>
              <Button
                label="Create"
                variant="secondary"
                size="sm"
                isDisabled={busy || !label.trim()}
                onClick={createToken}
              />
            </HStack>
          </div>
        </div>

        {error && <Text type="supporting" display="block" className="mt-3 text-rose-700 dark:text-rose-400">{error}</Text>}
      </div>
      {dialog}
    </Card>
  );
}
