"use client";

import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";

interface DownloadMenuProps {
  onPdf: () => void;
  onMarkdown: () => void;
  isDisabled?: boolean;
  /** A download is being prepared. */
  busy?: boolean;
}

/** One "Download" button offering the document as PDF or Markdown. */
export function DownloadMenu({ onPdf, onMarkdown, isDisabled = false, busy = false }: DownloadMenuProps) {
  return (
    <DropdownMenu
      button={{ label: busy ? "Preparing…" : "Download", variant: "secondary", size: "sm", isDisabled: isDisabled || busy }}
      hasChevron
      items={[
        { label: "PDF", onClick: onPdf },
        { label: "Markdown", onClick: onMarkdown },
      ]}
    />
  );
}
