"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Stack, HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Banner } from "@astryxdesign/core/Banner";
import { Spinner } from "@astryxdesign/core/Spinner";

interface ImportSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1iToTfa9tSrLq70vJ4_za_hRF7qsQKivD5d5akvSr5ds/edit#gid=0";

export function ImportSheetModal({ isOpen, onClose, onSuccess }: ImportSheetModalProps) {
  const [mode, setMode] = useState<"url" | "file">("url");
  const [sheetUrl, setSheetUrl] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("jobsLastSheetUrl") || DEFAULT_SHEET_URL;
    }
    return DEFAULT_SHEET_URL;
  });
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
        localStorage.setItem("jobsLastSheetUrl", sheetUrl.trim());
        bodyPayload = { sheetUrl: sheetUrl.trim() };
      }

      const res = await fetch("/api/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data: { imported?: number; skipped?: number; total?: number; error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to import spreadsheet.");
      }

      const msg = `Successfully imported ${data.imported ?? 0} jobs${data.skipped ? ` (${data.skipped} already existed)` : ""}.`;
      onSuccess(msg);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to import.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150"
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
              <Text type="display-3" as="h2">Import Jobs from Google Sheet</Text>
              <Text type="supporting" className="text-xs text-secondary mt-0.5">
                Sync job opportunities directly into your pipeline
              </Text>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-secondary hover:text-primary rounded p-1 transition cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <HStack gap={2} className="border-b border-border pb-3">
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition cursor-pointer ${
                mode === "url"
                  ? "bg-accent text-on-accent"
                  : "bg-surface text-secondary hover:bg-neutral hover:text-primary"
              }`}
            >
              Google Sheet URL
            </button>
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition cursor-pointer ${
                mode === "file"
                  ? "bg-accent text-on-accent"
                  : "bg-surface text-secondary hover:bg-neutral hover:text-primary"
              }`}
            >
              Upload CSV
            </button>
          </HStack>

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
                  💡 <strong>Sharing Requirement:</strong> Make sure the Google Sheet is shared with{" "}
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
                  className="block w-full text-sm text-secondary file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-xs file:font-semibold file:text-on-accent hover:file:opacity-90 cursor-pointer"
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
              label={loading ? "Importing…" : "Import Jobs"}
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
