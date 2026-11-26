"use client";

import { useState } from "react";
import { Icon } from "@/components/iconstack/Icon";
import { Button } from "./Button";
import styles from "./ui.module.css";

interface CodeBlockProps {
  code: string;
  language?: string;
  hasLanguageLabel?: boolean;
  hasCopyButton?: boolean;
  isWrapped?: boolean;
  width?: string;
  size?: "sm" | "md";
}

export function CodeBlock({ code, language, hasLanguageLabel, hasCopyButton, isWrapped, width }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className={`${styles.code} ${isWrapped ? styles.wrapped : ""} ${hasCopyButton ? styles.hasCopy : ""}`} style={{ width }}>
      {hasLanguageLabel && language && <span className={styles.codeLanguage}>{language}</span>}
      <pre><code>{code}</code></pre>
      {hasCopyButton && (
        <span className={styles.copyButton}>
          <Button label={copied ? "Copied" : "Copy"} size="sm" variant="secondary" icon={<Icon name={copied ? "check" : "copy"} size={13} />} onClick={copy} />
        </span>
      )}
    </div>
  );
}
