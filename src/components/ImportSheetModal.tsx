"use client";

import { useState } from "react";
import { loadLastSheetUrl, saveLastSheetUrl } from "@/lib/storage";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Stack, HStack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { Banner } from "@/components/ui/Banner";
import { Spinner } from "@/components/ui/Spinner";
import { apiSend, errorMessage } from "@/lib/api-client";
import { Icon } from "@/components/iconstack/Icon";
import { Tooltip } from "@/components/ui/Tooltip";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/SegmentedControl";

interface ImportSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}


export function ImportSheetModal({ isOpen, onClose, onSuccess }: ImportSheetModalProps) {
  const [mode, setMode] = useState<"url" | "file">("url");
  // Nothing renders while closed, so reading storage here never shows up in the server HTML.
  const [sheetUrl, setSheetUrl] = useState(loadLastSheetUrl);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleImport = async () => {
    setLoading(true);
    setError("");

    try {
      let bodyPayload: { sheetUrl?: string; csvText?: string } = {};

      if (mode === "file") {
        if (!file) {
          throw new Error("Please select a CSV file to upload.");
        }
        const text = await file.text();
        bodyPayload = { csvText: text };
      } else {
        if (!sheetUrl.trim()) {
          throw new Error("Please enter a Google Sheet URL or ID.");
        }
        saveLastSheetUrl(sheetUrl.trim());
        bodyPayload = { sheetUrl: sheetUrl.trim() };
      }

      const data = await apiSend<{ imported?: number; skipped?: number; total?: number }>(
        "/api/jobs/import", "POST", bodyPayload,
      );

      const msg = `Successfully imported ${data.imported ?? 0} jobs${data.skipped ? ` (${data.skipped} already existed)` : ""}.`;
      onSuccess(msg);
      onClose();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to import."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <Stack gap={4}>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <Text type="display-3" as="h2">Import jobs</Text>
              <Text type="supporting" className="text-xs text-secondary mt-0.5">
                From a Google Sheet or a CSV file.
              </Text>
            </div>
            <Tooltip content="Close">
              <button
                onClick={onClose}
                disabled={loading}
                className="text-secondary hover:text-primary rounded p-1 transition cursor-pointer"
                aria-label="Close"
              >
                <Icon name="x" size={16} />
              </button>
            </Tooltip>
          </div>

          <div className="border-b border-border pb-3">
            <SegmentedControl value={mode} onChange={(v) => setMode(v as typeof mode)} label="Import from">
              <SegmentedControlItem value="url" label="Google Sheet link" />
              <SegmentedControlItem value="file" label="Upload CSV" />
            </SegmentedControl>
          </div>

          {error && <Banner status="error" title={error} isDismissable onDismiss={() => setError("")} />}

          {mode === "url" ? (
            <Stack gap={3}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">
                  Google Spreadsheet Link or ID
                </label>
                <TextInput
                  label="Google Spreadsheet Link"
                  isLabelHidden
                  value={sheetUrl}
                  onChange={setSheetUrl}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="w-full font-mono text-xs"
                />
              </div>

              <div className="rounded-md bg-neutral/10 border border-border/50 p-3">
                <Text type="supporting" className="text-xs text-secondary leading-relaxed">
                  <Icon name="bulb" size={14} className="mr-1 -mt-0.5 text-amber-600" /><strong>Sharing:</strong> make sure the sheet is shared with{" "}
                  <em>&quot;Anyone with the link can view&quot;</em> so Job Search can read the rows.
                </Text>
              </div>
            </Stack>
          ) : (
            <Stack gap={3}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">
                  Choose CSV File
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-secondary file:mr-4 file:rounded-md file:border-0 file:bg-accent-bg file:px-4 file:py-2 file:text-xs file:font-semibold file:text-on-accent hover:file:opacity-90 cursor-pointer"
                />
              </div>

              {file && (
                <Text type="supporting" className="text-xs text-primary">
                  Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                </Text>
              )}
            </Stack>
          )}

          <HStack gap={3} className="justify-end pt-2 border-t border-border">
            <Button
              label="Cancel"
              variant="ghost"
              size="sm"
              onClick={onClose}
              isDisabled={loading}
            />
            <Button
              label={loading ? "Importing…" : "Import jobs"}
              variant="primary"
              size="sm"
              onClick={handleImport}
              isDisabled={loading || (mode === "file" && !file) || (mode === "url" && !sheetUrl.trim())}
              icon={loading ? <Spinner size="sm" label="Importing" /> : undefined}
            />
          </HStack>
        </Stack>
      </div>
    </div>
  );
}
