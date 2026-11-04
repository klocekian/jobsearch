"use client";

import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";

interface DownloadMenuProps {
  onPdf: () => void;
  onMarkdown: () => void;
  isDisabled?: boolean;
  /** A download is being prepared. */
  busy?: boolean;
  template?: "classic" | "lucid";
  onTemplateChange?: (template: "classic" | "lucid") => void;
}

/** One "Download" button offering the document as PDF or Markdown. */
export function DownloadMenu({ onPdf, onMarkdown, isDisabled = false, busy = false, template, onTemplateChange }: DownloadMenuProps) {
  return (
    <div className="flex items-center gap-2">
      {onTemplateChange && (
        <select
          aria-label="PDF template"
          value={template ?? "classic"}
          onChange={(event) => onTemplateChange(event.target.value as "classic" | "lucid")}
          disabled={isDisabled || busy}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
        >
          <option value="classic">Classic</option>
          <option value="lucid">Lucid</option>
        </select>
      )}
      <DropdownMenu
        button={{ label: busy ? "Preparing…" : "Download", variant: "secondary", size: "sm", isDisabled: isDisabled || busy }}
        hasChevron
        items={[
          { label: "PDF", onClick: onPdf },
          { label: "Markdown", onClick: onMarkdown },
        ]}
      />
    </div>
  );
}
