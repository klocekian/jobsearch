import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listResumes } from "@/lib/db/resumes";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSession().catch(() => null);
  const userId = user?.id ?? null;
  const resumes = await listResumes(userId);
  const def = resumes.find((r) => r.is_default) ?? resumes[0];

  if (!def) {
    return NextResponse.json({ error: "No resume saved" }, { status: 404 });
  }

  const text = def.content;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Name: first line that looks like a name (2-4 capitalized words, no digits/symbols)
  let fullName = "";
  for (const line of lines.slice(0, 5)) {
    const tokens = line.split(/\s+/);
    if (tokens.length >= 2 && tokens.length <= 4 && tokens.every((t) => /^[A-Z][a-zA-Z'-]+$/.test(t))) {
      fullName = line;
      break;
    }
  }
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");

  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch?.[0] ?? user?.email ?? "";

  // Phone (10+ digits)
  let phone = "";
  for (const m of text.matchAll(/\(?\+?\d[\d\s().-]{7,}\d/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) { phone = m[0].trim(); break; }
  }

  // LinkedIn, GitHub, website, substack
  const linkedinMatch = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s·,)]+/i);
  const githubMatch = text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s·,)]+/i);
  const substackMatch = text.match(/https?:\/\/[^\s·,)]*substack\.com[^\s·,)]*/i);
  const websiteMatch = text.match(/https?:\/\/(?:www\.)?(?!linkedin\.com|github\.com)[a-z0-9-]+\.(?!substack\.)[a-z]{2,}[^\s·,)]*/i);

  // Location: find the contact line (contains email/phone with · delimiters), then extract "City, State" from it
  const states = "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
  let city = "";
  let state = "";
  let location = "";
  // Split contact area by · and look for a segment matching "City, State"
  const contactArea = text.slice(0, 800);
  const segments = contactArea.split(/[·|•\n]/);
  const stateRe = new RegExp(`(${states})\\s*$`);
  for (const seg of segments) {
    const trimmed = seg.trim();
    // Look for ", State" at end of segment
    const sm = trimmed.match(stateRe);
    if (!sm) continue;
    // Everything before ", State" — take last 1-3 words as the city
    const beforeState = trimmed.slice(0, trimmed.lastIndexOf(sm[1])).replace(/,\s*$/, "").trim();
    const words = beforeState.split(/\s+/);
    const last = words[words.length - 1] ?? "";
    const secondLast = words[words.length - 2] ?? "";
    const multiWordPrefixes = ["San", "New", "Los", "Fort", "Saint", "St.", "Mount", "Mt.", "Las", "El", "La", "West", "East", "North", "South", "Palo", "Santa", "Menlo", "Redwood", "Salt", "Lake"];
    if (multiWordPrefixes.includes(secondLast)) {
      city = `${secondLast} ${last}`;
    } else {
      city = last;
    }
    state = sm[1].trim();
    location = `${city}, ${state}`;
    break;
  }

  // Current title and company from first Experience entry
  let currentTitle = "";
  let currentCompany = "";
  const expMatch = text.match(/^(.+?)\s*[—–-]\s*(.+?)\s*[·|]\s*/m);
  if (expMatch) {
    // Check it's not the headline by looking for it after "Experience"
    const expIdx = text.indexOf("Experience");
    if (expIdx > 0) {
      const afterExp = text.slice(expIdx);
      const titleMatch = afterExp.match(/^(.+?)\s*[—–-]\s*(.+?)\s*[·|]\s*/m);
      if (titleMatch) {
        currentTitle = titleMatch[1].trim();
        currentCompany = titleMatch[2].trim();
      }
    }
  }

  return NextResponse.json({
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email,
    phone,
    linkedin: linkedinMatch?.[0]?.replace(/[·,]+$/, "") ?? "",
    github: githubMatch?.[0]?.replace(/[·,]+$/, "") ?? "",
    website: websiteMatch?.[0]?.replace(/[·,]+$/, "") ?? "",
    substack: substackMatch?.[0]?.replace(/[·,]+$/, "") ?? "",
    city,
    state,
    location,
    current_title: currentTitle,
    current_company: currentCompany,
    work_authorized: true,
    sponsorship_required: false,
  });
}
