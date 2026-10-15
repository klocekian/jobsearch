import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCoverLetterDoc, type CoverPdfInput } from "@/lib/pdf/cover-letter";
import { extractPdfTextFromBuffer } from "@/lib/pdf";
import { checkParseFidelity } from "@/lib/analysis/parse-fidelity";

const letter: CoverPdfInput = {
  contact: {
    name: "Ada Lovelace",
    address: "London, UK",
    phone: "+44 20 1234 5678",
    email: "ada@example.com",
    website: "ada.dev",
  },
  date: "October 14, 2026",
  body: "I build reliable software for complex systems and collaborate closely with product teams.\n\nI would welcome the opportunity to help your team deliver clear, useful tools.",
};

const classicText = "Ada Lovelace London, UK • +44 20 1234 5678 • ada@example.com • ada.dev October 14, 2026 I build reliable software for complex systems and collaborate closely with product teams.\nI would welcome the opportunity to help your team deliver clear, useful tools.";

describe("cover-letter PDF templates", () => {
  it("keeps Classic as the default with its existing extracted text", async () => {
    const defaultDoc = await buildCoverLetterDoc(letter);
    const classicDoc = await buildCoverLetterDoc(letter, { template: "classic" });
    const defaultText = await extractPdfTextFromBuffer(defaultDoc.output("arraybuffer"));
    const classic = await extractPdfTextFromBuffer(classicDoc.output("arraybuffer"));
    assert.equal(defaultText.rawText, classicText);
    assert.equal(classic.rawText, classicText);
  });

  it("round-trips Lucid with readable contact and body", async () => {
    const doc = await buildCoverLetterDoc(letter, { template: "lucid" });
    const extracted = await extractPdfTextFromBuffer(doc.output("arraybuffer"));
    const issues = checkParseFidelity(extracted.rawText).filter((item) => item.status !== "pass");
    assert.deepEqual(issues, []);
    for (const expected of [
      "Ada Lovelace", "London, UK", "+44 20 1234 5678", "ada@example.com", "ada.dev",
      "October 14, 2026", "I build reliable software for complex systems",
      "I would welcome the opportunity to help your team deliver clear, useful tools.",
    ]) {
      assert.ok(extracted.rawText.includes(expected), `missing ${expected}: ${extracted.rawText}`);
    }
    assert.equal(extracted.pages, 1);
  });

  it("sets document properties for both templates", async () => {
    for (const template of ["classic", "lucid"] as const) {
      const doc = await buildCoverLetterDoc(letter, { template });
      const pdf = doc.output();
      assert.match(pdf, /\/Title \(/);
      assert.match(pdf, /\/Author \(Ada Lovelace\)/);
      assert.match(pdf, /\/Subject \(Cover Letter\)/);
      assert.match(pdf, /\/Keywords \(cover letter\)/);
    }
  });
});
