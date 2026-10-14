import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkParseFidelity } from "@/lib/analysis/parse-fidelity";
import { readyToApply } from "@/lib/analysis/ready-to-apply";
import { buildResumeDoc } from "@/lib/pdf/resume";
import { extractPdfTextFromBuffer } from "@/lib/pdf";
import type { ResumeData } from "@/lib/resume/types";

const resume: ResumeData = {
  name: "Ada Lovelace",
  headline: "Software Engineer",
  location: "London, UK",
  phone: "+44 20 1234 5678",
  email: "ada@example.com",
  website: "",
  linkedin: "",
  github: "",
  summary: "Builds reliable software for complex systems.",
  experience: [{ role: "Engineer", company: "Analytical Engines", dates: "2020–2026", bullets: ["Built resilient tools."] }],
  education: [],
  skills: "TypeScript, systems design",
};

describe("PDF export gate", () => {
  it("requires explicit confirmation when text is image-only", () => {
    const result = readyToApply(checkParseFidelity(" "), { fitness: 72, match: 81, aiBand: "low" });
    assert.equal(result.parseStatus, "fail");
    assert.equal(result.needsConfirmation, true);
    assert.deepEqual([result.fitness, result.match, result.aiBand], [72, 81, "low"]);
  });

  for (const template of ["classic", "lucid"] as const) {
    it(`does not interrupt a generated ${template} PDF`, async () => {
      const doc = await buildResumeDoc(resume, { template });
      const { rawText } = await extractPdfTextFromBuffer(doc.output("arraybuffer"));
      const result = readyToApply(checkParseFidelity(rawText));
      assert.equal(result.failures, 0);
      assert.equal(result.needsConfirmation, false);
      assert.equal(result.parseStatus, template === "classic" ? "warning" : "pass");
    });
  }

  it("shows warnings without requiring confirmation", () => {
    const result = readyToApply([{ status: "warning", message: "Review heading spacing." }]);
    assert.equal(result.parseStatus, "warning");
    assert.equal(result.warnings, 1);
    assert.equal(result.needsConfirmation, false);
  });
});
