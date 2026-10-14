import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildResumeDoc } from "@/lib/pdf/resume";
import { extractPdfText, extractPdfTextFromBuffer } from "@/lib/pdf";
import { readResumeFile } from "@/lib/extract";
import { checkParseFidelity } from "@/lib/analysis/parse-fidelity";
import type { ResumeData } from "@/lib/resume/types";

const resume: ResumeData = {
  name: "Ada Lovelace",
  headline: "Software Engineer",
  location: "London, UK",
  phone: "+44 20 1234 5678",
  email: "ada@example.com",
  website: "",
  linkedin: "https://www.linkedin.com/in/ada-lovelace",
  github: "https://github.com/ada",
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
  it("keeps Classic as the default and extracts Lucid without fidelity warnings", async () => {
    const defaultDoc = await buildResumeDoc(resume);
    const classicDoc = await buildResumeDoc(resume, { template: "classic" });
    const lucidDoc = await buildResumeDoc(resume, { template: "lucid" });
    const extract = async (doc: Awaited<ReturnType<typeof buildResumeDoc>>) =>
      extractPdfTextFromBuffer(doc.output("arraybuffer"));
    const [defaultText, classicText, lucidText] = await Promise.all([
      extract(defaultDoc), extract(classicDoc), extract(lucidDoc),
    ]);

    assert.equal(defaultText.rawText, classicText.rawText, "Classic remains the default layout");
    for (const text of [classicText, lucidText]) assertResumeText(text.text);

    const classicIssues = checkParseFidelity(classicText.rawText).filter((item) => item.status !== "pass");
    assert.equal(classicIssues.length, 1, JSON.stringify(classicIssues));
    assert.match(classicIssues[0].message, /spaces between its letters/);

    const lucidIssues = checkParseFidelity(lucidText.rawText).filter((item) => item.status !== "pass");
    assert.deepEqual(lucidIssues, []);
    assert.match(lucidText.rawText, /Ada Lovelace/);
    assert.match(lucidText.rawText, /ada@example.com/);
    assert.match(lucidText.rawText, /github.com\/ada/);
    assert.match(lucidText.rawText, /linkedin.com\/in\/ada-lovelace/);
    assert.ok(lucidText.rawText.split("\n").some((line) =>
      line.includes("Engineer, Analytical Engines") && line.includes("2020")
    ), lucidText.rawText);
    assert.match(lucidDoc.output(), /\/URI \(https:\/\/github.com\/ada\)/);
    assert.match(lucidDoc.output(), /\/URI \(https:\/\/www.linkedin.com\/in\/ada-lovelace\)/);
    for (const doc of [classicDoc, lucidDoc]) {
      assert.match(doc.output(), /\/Title \(/);
      assert.match(doc.output(), /\/Author \(Ada Lovelace\)/);
      assert.match(doc.output(), /\/Subject \(Software Engineer\)/);
      assert.match(doc.output(), /\/Keywords \(Software Engineer\)/);
    }
  });

  it("round-trips a generated resume from a buffer and through the File wrapper", async () => {
    const doc = await buildResumeDoc(resume);
    const buffer = doc.output("arraybuffer");
    const extracted = await extractPdfTextFromBuffer(new Uint8Array(buffer.slice(0)));
    assert.equal(extracted.pages, 1);
    assertResumeText(extracted.text);
    assert.ok(extracted.rawText.includes("ada@example.com"));

    const file = new File([buffer], "resume.pdf", { type: "application/pdf" });
    const fromFile = await extractPdfText(file);
    assert.deepEqual(fromFile, extracted);

    const uploaded = await readResumeFile(file);
    assert.equal(uploaded.text, extracted.text);
    assert.ok(uploaded.fidelity?.length, "PDF uploads include fidelity diagnostics");

    const plain = await readResumeFile(new File(["Plain resume"], "resume.txt", { type: "text/plain" }));
    assert.equal(plain.fidelity, undefined, "text uploads do not get PDF diagnostics");
  });
});
