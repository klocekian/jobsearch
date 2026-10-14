import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkParseFidelity } from "@/lib/analysis/parse-fidelity";

const clean = [
  "Ada Lovelace",
  "ada@example.com",
  "+44 20 1234 5678",
  "Summary",
  "Builds reliable software for complex systems and helps teams deliver maintainable tools.",
  "Experience",
  "Engineer at Analytical Engines, 2020 to 2026. Built resilient services for many users.",
  "Education",
  "BSc Mathematics at London University.",
  "Skills",
  "TypeScript, systems design, and testing.",
].join("\n");

function warnings(text: string, expected?: string): string[] {
  return checkParseFidelity(text, expected)
    .filter((item) => item.status !== "pass")
    .map((item) => item.message);
}

describe("parse fidelity", () => {
  it("accepts clean, readable single-column text", () => {
    assert.deepEqual(warnings(clean), []);
  });

  it("flags missing word spaces without mistaking an email for a word", () => {
    assert.match(warnings(clean.replace("Builds reliable software for complex systems", "Buildsreliablesoftwareforcomplexsystems,"))[0], /joined without spaces/);
  });

  it("finds letter-spaced headings in the raw text", () => {
    assert.match(warnings(clean.replace("Summary", "S U M M A R Y"))[0], /spaces between its letters/);
  });

  it("flags ligatures", () => {
    assert.match(warnings(clean.replace("reliable", "reliable ﬁ"))[0], /ligature/);
  });

  it("flags private-use icon glyphs", () => {
    assert.match(warnings(clean.replace("Ada Lovelace", "Ada Lovelace \uE001"))[0], /private-use/);
  });

  it("reports near-zero selectable text as a failure", () => {
    assert.deepEqual(checkParseFidelity("\uE001\n\uE002"), [
      { status: "fail", message: "Very little selectable text was found. This PDF may be image-only; upload a text-based PDF or paste the resume text." },
    ]);
  });

  it("flags likely column interleaving", () => {
    assert.match(warnings(clean.replace("Experience\n", "Experience    Skills\n"))[0], /columns may be interleaved/);
  });

  it("flags a summary that appears after the main sections", () => {
    const late = clean.replace("Summary\n", "").replace("Education\n", "Education\nSummary\n");
    assert.match(warnings(late)[0], /summary appears after/);
  });

  it("flags contact details that appear after the first eight lines", () => {
    const late = clean.replace("ada@example.com\n+44 20 1234 5678\n", "") + "\nada@example.com\n+44 20 1234 5678";
    assert.match(warnings(late)[0], /first eight nonempty lines/);
  });

  it("compares source contact details when expected text is supplied", () => {
    assert.deepEqual(warnings(clean, clean), []);
    assert.match(warnings(clean, clean.replace("ada@example.com", "other@example.com"))[0], /did not survive/);
  });
});
