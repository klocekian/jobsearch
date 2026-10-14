import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildResumeDoc } from "@/lib/pdf/resume";
import { extractPdfText, extractPdfTextFromBuffer } from "@/lib/pdf";
import type { ResumeData } from "@/lib/resume/types";

const resume: ResumeData = {
  name: "Ada Lovelace",
  headline: "Software Engineer",
  location: "London, UK",
  phone: "+44 20 1234 5678",
  email: "ada@example.com",
  website: "",
  linkedin: "",
  summary: "Builds reliable software for complex systems.",
  experience: [{ role: "Engineer", company: "Analytical Engines", dates: "2020–2026", bullets: ["Built resilient tools."] }],
  education: [{ degree: "BSc Mathematics", school: "London University", dates: "2016–2020" }],
  skills: "TypeScript, systems design",
};

function assertResumeText(text: string): void {
  for (const expected of ["Ada Lovelace", "ada@example.com", "SUMMARY", "EXPERIENCE", "EDUCATION", "SKILLS"]) {
    assert.ok(text.includes(expected), `missing ${expected} from extracted text:\n${text}`);
  }
}

describe("PDF text extraction", () => {
  it("round-trips a generated resume from a buffer and through the File wrapper", async () => {
    const doc = await buildResumeDoc(resume);
    const buffer = doc.output("arraybuffer");
    const extracted = await extractPdfTextFromBuffer(new Uint8Array(buffer.slice(0)));
    assert.equal(extracted.pages, 1);
    assertResumeText(extracted.text);

    const file = new File([buffer], "resume.pdf", { type: "application/pdf" });
    const fromFile = await extractPdfText(file);
    assert.deepEqual(fromFile, extracted);
  });
});
