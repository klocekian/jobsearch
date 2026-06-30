import { SKILL_TAXONOMY } from "@/lib/analysis/taxonomy";

interface JobDescriptionViewProps {
  jobText: string;
  jobTitle: string;
  matched: string[];
  missing: string[];
}

interface Token {
  text: string;
  state: "matched" | "missing" | null;
}

/**
 * Highlights skill terms in the job description: matched skills get a green
 * underline, missing skills a red one — mirroring the reference report's
 * "Job Description" tab.
 */
function highlight(text: string, matched: Set<string>, missing: Set<string>): Token[] {
  // Build a regex of all variants for skills we care about.
  const relevant = SKILL_TAXONOMY.filter((d) => matched.has(d.name) || missing.has(d.name));
  const variantToState = new Map<string, "matched" | "missing">();
  for (const d of relevant) {
    const state = matched.has(d.name) ? "matched" : "missing";
    for (const v of d.variants) variantToState.set(v.toLowerCase(), state);
  }
  if (variantToState.size === 0) return [{ text, state: null }];

  const pattern = [...variantToState.keys()]
    .sort((a, b) => b.length - a.length)
    .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const re = new RegExp(`(?<![A-Za-z0-9])(${pattern})(?![A-Za-z0-9])`, "gi");

  const tokens: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) tokens.push({ text: text.slice(last, idx), state: null });
    tokens.push({ text: m[0], state: variantToState.get(m[0].toLowerCase()) ?? null });
    last = idx + m[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), state: null });
  return tokens;
}

export function JobDescriptionView({ jobText, jobTitle, matched, missing }: JobDescriptionViewProps) {
  const tokens = highlight(jobText, new Set(matched), new Set(missing));
  return (
    <div>
      <div className="mb-4 flex gap-6 text-sm">
        <span className="flex items-center gap-2 text-slate-600">
          <span className="inline-block h-1 w-5 rounded bg-rose-400" /> Missing Skills
        </span>
        <span className="flex items-center gap-2 text-slate-600">
          <span className="inline-block h-1 w-5 rounded bg-emerald-400" /> Matched Skills
        </span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-700">
        <pre className="whitespace-pre-wrap font-sans">
          {tokens.map((t, i) =>
            t.state ? (
              <span
                key={i}
                className={
                  t.state === "matched"
                    ? "underline decoration-emerald-400 decoration-2 underline-offset-2"
                    : "underline decoration-rose-400 decoration-2 underline-offset-2"
                }
              >
                {t.text}
              </span>
            ) : (
              <span key={i}>{t.text}</span>
            )
          )}
        </pre>
      </div>
    </div>
  );
}
