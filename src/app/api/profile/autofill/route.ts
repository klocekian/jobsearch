import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listResumes } from "@/lib/db/resumes";
import { extractContact } from "@/lib/contact";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSession().catch(() => null);
  const userId = user?.id ?? null;
  const resumes = await listResumes(userId);
  const def = resumes.find((r) => r.is_default) ?? resumes[0];

  if (!def) {
    return NextResponse.json({ error: "No resume saved" }, { status: 404 });
  }

  const contact = extractContact(def.content);
  const text = def.content;

  const nameParts = contact.name.split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");

  const linkedinMatch = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s,)]+/i);
  const githubMatch = text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s,)]+/i);
  const substackMatch = text.match(/https?:\/\/[^\s,)]*substack\.com[^\s,)]*/i);

  const locationParts = contact.address.split(",").map((s) => s.trim());
  const city = locationParts[0] ?? "";
  const state = locationParts[1] ?? "";

  const titleMatch = text.match(/^(.+?)\s*[—–-]\s*(.+?)(?:\s*[·|]|$)/m);

  return NextResponse.json({
    first_name: firstName,
    last_name: lastName,
    full_name: contact.name,
    email: contact.email || user?.email || "",
    phone: contact.phone,
    linkedin: linkedinMatch?.[0] ?? "",
    github: githubMatch?.[0] ?? "",
    website: contact.website,
    substack: substackMatch?.[0] ?? "",
    city,
    state,
    location: contact.address,
    current_title: titleMatch?.[1]?.trim() ?? "",
    current_company: titleMatch?.[2]?.trim() ?? "",
    work_authorized: true,
    sponsorship_required: false,
  });
}
