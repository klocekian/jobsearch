import { SKILL_TAXONOMY } from "@/lib/analysis/taxonomy";
import { Text } from "@astryxdesign/core/Text";
import { HStack } from "@astryxdesign/core/Stack";
import { Card } from "@astryxdesign/core/Card";

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

function highlight(text: string, matched: Set<string>, missing: Set<string>): Token[] {
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
      <HStack gap={4} className="mb-4">
        <HStack gap={2} className="items-center">
          <span className="inline-block h-1 w-5 rounded bg-rose-400" />
          <Text type="supporting">Missing Skills</Text>
        </HStack>
        <HStack gap={2} className="items-center">
          <span className="inline-block h-1 w-5 rounded bg-emerald-400" />
          <Text type="supporting">Matched Skills</Text>
        </HStack>
      </HStack>
      <Card className="p-6">
        <pre className="whitespace-pre-wrap font-sans leading-7">
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
      </Card>
    </div>
  );
}
