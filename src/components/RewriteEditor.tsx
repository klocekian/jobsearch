"use client";

import { memo, useRef, useState } from "react";
import { applyChange, buildReview, type ReviewNode } from "@/lib/diff";

interface RewriteEditorProps {
  /** The AI rewrite (suggestion source). Empty string = no suggestions yet. */
  rewrite: string;
  /** Working document at mount (the editor is uncontrolled thereafter). */
  initialResult: string;
  /** Keys of changes the user has dismissed. */
  initialDismissed: string[];
  /** Called whenever the working document or dismissed set changes. */
  onChange: (result: string, dismissed: string[]) => void;
}

/** Serialize the contentEditable back to plain text. Widgets contribute their
 * current (del) text; block elements and <br> become newlines. */
function readNode(el: Node): string {
  let out = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
    } else if (node instanceof HTMLElement) {
      if (node.dataset.del !== undefined) {
        out += node.dataset.del;
      } else if (node.tagName === "BR") {
        out += "\n";
      } else {
        const block = /^(DIV|P|LI)$/.test(node.tagName);
        if (block && out && !out.endsWith("\n")) out += "\n";
        out += readNode(node);
      }
    }
  });
  return out;
}

/** Review nodes for the current text, with dismissed changes shown as plain text. */
function reviewNodes(result: string, rewrite: string, dismissed: Set<string>): ReviewNode[] {
  if (!rewrite.trim()) return [{ kind: "text", text: result }];
  return buildReview(result, rewrite).map((n) =>
    n.kind === "change" && dismissed.has(n.key) ? { kind: "text", text: n.del } : n
  );
}

function RewriteEditorInner({ rewrite, initialResult, initialDismissed, onChange }: RewriteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const dismissed = useRef<Set<string>>(new Set(initialDismissed));
  const [nodes, setNodes] = useState<ReviewNode[]>(() =>
    reviewNodes(initialResult, rewrite, new Set(initialDismissed))
  );

  const serialize = () => (editorRef.current ? readNode(editorRef.current) : initialResult);

  const refresh = (text: string) => {
    onChange(text, [...dismissed.current]);
    setNodes(reviewNodes(text, rewrite, dismissed.current));
  };

  const accept = (key: string) => {
    const next = applyChange(serialize(), rewrite, key);
    refresh(next);
  };

  const dismiss = (key: string) => {
    dismissed.current.add(key);
    refresh(serialize());
  };

  const handleBlur = () => refresh(serialize());

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      spellCheck={false}
      className="min-h-[28rem] w-full whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
    >
      {nodes.map((n, i) =>
        n.kind === "text" ? (
          <span key={i}>{n.text}</span>
        ) : (
          <ChangeWidget key={i} del={n.del} ins={n.ins} onAccept={() => accept(n.key)} onDismiss={() => dismiss(n.key)} />
        )
      )}
    </div>
  );
}

function ChangeWidget({
  del,
  ins,
  onAccept,
  onDismiss,
}: {
  del: string;
  ins: string;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  // contentEditable=false makes the widget atomic; data-del feeds serialization.
  // onMouseDown + preventDefault keeps focus/caret in the editor.
  const click = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };
  return (
    <span
      contentEditable={false}
      data-del={del}
      className="mx-0.5 inline rounded border border-slate-200 bg-slate-50 px-0.5 align-baseline"
    >
      {del && <span className="text-rose-700 line-through">{del}</span>}
      {ins ? (
        <button
          type="button"
          onMouseDown={click(onAccept)}
          title="Accept this suggestion"
          className="rounded bg-emerald-100 px-0.5 text-emerald-900 hover:bg-emerald-200"
        >
          {ins}
        </button>
      ) : (
        <button
          type="button"
          onMouseDown={click(onAccept)}
          title="Remove this text"
          className="rounded px-0.5 text-rose-700 hover:bg-rose-100"
        >
          ⌫
        </button>
      )}
      <button
        type="button"
        onMouseDown={click(onDismiss)}
        title="Dismiss (keep current)"
        className="ml-0.5 rounded px-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
      >
        ×
      </button>
    </span>
  );
}

// Isolate from parent re-renders: the editor is uncontrolled, and the parent
// forces a fresh instance (via `key`) on structural changes (generate, accept
// all, reset). This prevents React from reconciling — and clobbering — the
// user's in-progress typing.
export const RewriteEditor = memo(RewriteEditorInner, () => true);
