// Curated skills taxonomy + synonym map. Seeded with UX / product / engineering
// terms plus the domain terms that appear in the sample reports. The synonym map
// lets "user research" and "UX research" match the same canonical skill so that
// surface-level lexical mismatches don't produce false negatives.

export interface SkillDef {
  /** Canonical display name. */
  name: string;
  kind: "hard" | "soft";
  /** Lowercase surface forms that count as a hit for this skill. */
  variants: string[];
}

export const SKILL_TAXONOMY: SkillDef[] = [
  // --- Hard skills ---
  { name: "UX", kind: "hard", variants: ["ux", "user experience", "ux design", "user-experience"] },
  { name: "AI", kind: "hard", variants: ["ai", "artificial intelligence", "ai-native", "ai-first", "machine learning", "ml"] },
  { name: "Research", kind: "hard", variants: ["research", "user research", "ux research", "design research"] },
  { name: "Quality improvement", kind: "hard", variants: ["quality improvement", "quality", "up-leveling quality"] },
  { name: "Systems Thinking", kind: "hard", variants: ["systems thinking", "systems-thinking", "systems-oriented", "systems thinker"] },
  { name: "Content strategy", kind: "hard", variants: ["content strategy", "content-strategy", "content design"] },
  { name: "User needs", kind: "hard", variants: ["user needs", "user-needs", "customer needs"] },
  { name: "Journalism", kind: "hard", variants: ["journalism", "journalist", "editorial"] },
  { name: "APAC", kind: "hard", variants: ["apac", "asia pacific", "asia-pacific"] },
  { name: "HCI", kind: "hard", variants: ["hci", "human-computer interaction", "human computer interaction"] },
  { name: "Product Management", kind: "hard", variants: ["product management", "product manager", "pm", "product strategy"] },
  { name: "Design Systems", kind: "hard", variants: ["design system", "design systems"] },
  { name: "Prototyping", kind: "hard", variants: ["prototyping", "prototype", "prototypes"] },
  { name: "Roadmap", kind: "hard", variants: ["roadmap", "roadmapping", "road map"] },
  { name: "Data Analysis", kind: "hard", variants: ["data analysis", "analytics", "data-driven", "metrics"] },

  // --- Soft skills ---
  { name: "Leadership", kind: "soft", variants: ["leadership", "leader", "leading", "lead", "led"] },
  { name: "Advocacy", kind: "soft", variants: ["advocacy", "advocate", "advocating"] },
  { name: "Adaptable", kind: "soft", variants: ["adaptable", "adaptability", "adaptive", "resilient", "resilience"] },
  { name: "Collaboration", kind: "soft", variants: ["collaboration", "collaborative", "cross-functional", "partnership"] },
  { name: "Communication", kind: "soft", variants: ["communication", "communicate", "storytelling"] },
  { name: "Mentorship", kind: "soft", variants: ["mentorship", "mentor", "mentoring", "coaching"] },
];

/** Build a lookup from any variant -> canonical SkillDef. */
export function buildVariantIndex(): Map<string, SkillDef> {
  const index = new Map<string, SkillDef>();
  for (const def of SKILL_TAXONOMY) {
    for (const v of def.variants) index.set(v, def);
  }
  return index;
}
