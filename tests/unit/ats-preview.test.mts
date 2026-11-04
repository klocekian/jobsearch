import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAtsPreview } from "@/lib/resume/ats-preview";

const savedText = [
  "Ada Lovelace",
  "ada@example.com · (415) 555-0100 · San Francisco, CA",
  "Experience",
  "Software Engineer — Analytical Engines | Jan 2020 - Present",
  "Built reliable services.",
  "Skills",
  "TypeScript, SQL, testing",
].join("\n");

describe("ATS field preview", () => {
  it("shows the recognized contact, dated role, and skills from saved text", () => {
    const preview = getAtsPreview(savedText);
    assert.equal(preview.name, "Ada Lovelace");
    assert.equal(preview.contact.email, "ada@example.com");
    assert.equal(preview.contact.phone, "(415) 555-0100");
    assert.deepEqual(preview.roles, [{
      role: "Software Engineer",
      company: "Analytical Engines",
      dates: "Jan 2020 - Present",
    }]);
    assert.deepEqual(preview.skills, ["TypeScript", "SQL", "testing"]);
    assert.deepEqual(preview.issues, []);
  });

  it("flags a dated experience entry with no parsed title", () => {
    const preview = getAtsPreview("Ada Lovelace\nada@example.com · (415) 555-0100\nExperience\n2022 - Present\nSkills\nSQL");
    assert.deepEqual(preview.roles, [{ role: "", company: "", dates: "2022 - Present" }]);
    assert.match(preview.issues.join(" "), /Role 1 has no title/);
  });

  it("flags fields that the existing parser cannot recover", () => {
    const preview = getAtsPreview("Professional summary\nDelivered platform systems.\nExperience\nLed engineering teams.");
    assert.equal(preview.name, "");
    assert.deepEqual(preview.roles, []);
    assert.deepEqual(preview.skills, []);
    assert.match(preview.issues.join(" "), /Name was not recognized/);
    assert.match(preview.issues.join(" "), /No dated roles were recognized/);
    assert.match(preview.issues.join(" "), /No skills section was recognized/);
  });
});
