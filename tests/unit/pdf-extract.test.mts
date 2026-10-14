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
    assert.match(classicIssues[0].message, /corrected them in the saved text/);

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

  for (const template of ["classic", "lucid"] as const) {
    it(`keeps consecutive bulletless experience entries on separate lines in ${template}`, async () => {
      const bulletless: ResumeData = {
        ...resume,
        linkedin: "",
        github: "",
        education: [],
        experience: [
          { role: "IT Manager", company: "GREENSKIES CLEAN ENERGY", dates: "July 2018 – June 2023", bullets: [] },
          { role: "IT Administrator", company: "CLEAN FOCUS RENEWABLES", dates: "Oct 2014 – July 2018", bullets: [] },
        ],
      };
      const doc = await buildResumeDoc(bulletless, { template });
      const { rawText } = await extractPdfTextFromBuffer(doc.output("arraybuffer"));
      const lines = rawText.split("\n");
      assert.ok(lines.some((line) => line.includes("IT Manager, GREENSKIES CLEAN ENERGY") && !line.includes("IT Administrator")), `${template}: ${rawText}`);
      assert.ok(lines.some((line) => line.includes("IT Administrator, CLEAN FOCUS RENEWABLES") && !line.includes("IT Manager")), `${template}: ${rawText}`);
    });
  }

  for (const template of ["classic", "lucid"] as const) {
    it(`joins long wrapped bullets without joining separate bullets in ${template}`, async () => {
      const longBullet = "Coordinated reliable systems across multiple teams with careful planning and clear communication for customers and colleagues while improving delivery and maintaining a consistent experience for every customer.";
      const doc = await buildResumeDoc({
        ...resume,
        experience: [{ role: "Engineer", company: "Analytical Engines", dates: "2020–2026", bullets: [longBullet, longBullet] }],
      }, { template });
      const { rawText } = await extractPdfTextFromBuffer(doc.output("arraybuffer"));
      const bulletLines = rawText.split("\n").filter((line) => line.startsWith("•"));
      assert.equal(bulletLines.length, 2, `${template}: ${rawText}`);
      for (const line of bulletLines) {
        assert.ok(line.includes("Coordinated reliable systems") && line.includes("every customer."), `${template}: ${rawText}`);
      }
    });
  }

  it("keeps paragraph gaps and section headings separate", async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.text("SUMMARY", 56, 100);
    doc.text("First paragraph wraps", 56, 119);
    doc.text("across the page", 56, 133);
    doc.text("Second paragraph starts", 56, 158);
    doc.text("and continues", 56, 172);
    doc.text("EXPERIENCE", 56, 202);
    const { rawText } = await extractPdfTextFromBuffer(doc.output("arraybuffer"));
    assert.match(rawText, /SUMMARY\n(?:\n)?First paragraph wraps across the page/);
    assert.match(rawText, /across the page\n\nSecond paragraph starts and continues/);
    assert.match(rawText, /and continues\n(?:\n)?EXPERIENCE/);
  });

  it("stitches a bullet across PDF pages", async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.text("• Coordinated the migration with careful planning", 56, 100);
    doc.text("and shared progress with every team", 56, 114);
    doc.addPage();
    doc.text("while preserving reliable delivery", 56, 100);
    doc.text("for customers and colleagues.", 56, 114);
    const extracted = await extractPdfTextFromBuffer(doc.output("arraybuffer"));
    assert.equal(extracted.pages, 2);
    assert.match(extracted.rawText, /every team\n\nwhile preserving/);
    assert.match(extracted.text, /• Coordinated the migration with careful planning and shared progress with every team while preserving reliable delivery for customers and colleagues\./);
  });

  it("extracts a multi-page generated resume with long wrapped bullets", async () => {
    const bullets = Array.from({ length: 16 }, (_, i) => `Project ${i + 1} coordinated reliable systems across multiple teams with careful planning and clear communication for customers and colleagues while improving delivery and maintaining a consistent experience for every customer.`);
    const doc = await buildResumeDoc({
      ...resume,
      experience: [{ role: "Engineer", company: "Analytical Engines", dates: "2020–2026", bullets }],
    }, { template: "lucid" });
    const extracted = await extractPdfTextFromBuffer(doc.output("arraybuffer"));
    assert.ok(extracted.pages >= 2, `expected multiple pages, got ${extracted.pages}`);
    for (let i = 1; i <= bullets.length; i++) {
      const matching = extracted.text.split("\n").filter((line) => line.includes(`Project ${i} coordinated`));
      assert.equal(matching.length, 1, `Project ${i}: ${extracted.text}`);
      assert.ok(matching[0].includes("every customer."), `Project ${i}: ${extracted.text}`);
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
