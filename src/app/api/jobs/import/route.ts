import { NextResponse } from "next/server";
import { createJob, listJobs } from "@/lib/db/jobs";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const SHEET_ID = "1iToTfa9tSrLq70vJ4_za_hRF7qsQKivD5d5akvSr5ds";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let fields: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else if (ch === '"') { inQuotes = true; }
    else if (ch === ",") { fields.push(current); current = ""; }
    else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
      if (ch === "\r") i++;
      fields.push(current); rows.push(fields); fields = []; current = "";
    } else { current += ch; }
  }
  if (current || fields.length) { fields.push(current); rows.push(fields); }
  return rows;
}

function statusFromSheet(raw: string, hasDate: boolean): string {
  const lower = raw.toLowerCase().trim();
  if (lower === "interview") return "interview";
  if (lower === "closed" || lower === "not proceeding") return "closed";
  if (lower === "applied") return "applied";
  if (lower === "offer") return "offer";
  if (lower === "rejected") return "rejected";
  if (lower === "stale" || lower === "ghosted" || lower === "no response") return "stale";
  if (lower === "withdrawn") return "withdrawn";
  if (hasDate) return "applied";
  return "saved";
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  january: "01", february: "02", march: "03", april: "04", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function parseDate(raw: string): string | null {
  const d = raw.replace(/,/g, "").trim();
  if (!d) return null;
  const m = d.match(/^(\w+)[\s-]+(\d{1,2})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return `2026-${month}-${m[2].padStart(2, "0")}`;
  }
  const m2 = d.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m2) return `2026-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
  return null;
}

function extractSheetExportUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
    if (idMatch) {
      const sheetId = idMatch[1];
      const gid = gidMatch ? gidMatch[1] : "0";
      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    }
    return trimmed;
  }
  return `https://docs.google.com/spreadsheets/d/${trimmed}/export?format=csv&gid=0`;
}

export const POST = withUser(async (req, userId) => {
  try {
    let bodyJson: { sheetUrl?: string; csvText?: string } = {};
    try {
      bodyJson = await req.json();
    } catch {
      // Body may be empty if called without payload
    }

    let csvContent = bodyJson.csvText;

    if (!csvContent) {
      const targetUrl = bodyJson.sheetUrl ? extractSheetExportUrl(bodyJson.sheetUrl) : CSV_URL;
      const res = await fetch(targetUrl);
      if (!res.ok) {
        return NextResponse.json(
          { error: `Could not fetch spreadsheet (${res.status}). Ensure sharing is set to 'Anyone with the link can view'.` },
          { status: 502 },
        );
      }
      csvContent = await res.text();
    }

    const rows = parseCSV(csvContent);
    if (rows.length < 2) {
      return NextResponse.json({ imported: 0, skipped: 0, message: "No data rows found in sheet." });
    }

    // Detect column indexes from header row
    const headers = rows[0].map((h) => h.toLowerCase().trim());
    let companyIdx = headers.findIndex((h) => h.includes("company") || h.includes("employer") || h.includes("org"));
    let titleIdx = headers.findIndex((h) => h.includes("title") || h.includes("role") || h.includes("position"));
    let dateIdx = headers.findIndex((h) => h.includes("applied") || h.includes("date"));
    let statusIdx = headers.findIndex((h) => h.includes("status") || h.includes("stage"));
    let urlIdx = headers.findIndex((h) => h === "url" || h.includes("link") || h.includes("posting"));
    let textIdx = headers.findIndex((h) => h.includes("description") || h.includes("notes") || h.includes("text") || h.includes("details"));

    // Fallbacks to standard layout if not detected
    if (companyIdx === -1) companyIdx = 1;
    if (titleIdx === -1) titleIdx = 2;
    if (dateIdx === -1) dateIdx = 3;
    if (statusIdx === -1) statusIdx = 5;
    if (urlIdx === -1) urlIdx = 7;
    if (textIdx === -1) textIdx = 8;

    const existing = await listJobs(userId);
    const existingKeys = new Set(existing.map((j) => `${j.company.toLowerCase()}|${j.title.toLowerCase()}`));

    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const company = (cols[companyIdx] ?? "").trim();
      const title = (cols[titleIdx] ?? "").trim();
      const date = (dateIdx >= 0 ? cols[dateIdx] : "") ?? "";
      const status = (statusIdx >= 0 ? cols[statusIdx] : "") ?? "";
      const url = (urlIdx >= 0 ? cols[urlIdx] : "") ?? "";
      const jobText = (textIdx >= 0 ? cols[textIdx] : "") ?? "";

      if (!company && !title) continue;
      const key = `${company.toLowerCase()}|${title.toLowerCase()}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      const parsedDate = parseDate(date);
      await createJob({
        user_id: userId,
        company: company || "Unknown Company",
        title: title || "Job Opportunity",
        url,
        status: statusFromSheet(status, !!parsedDate),
        posting_text: jobText,
        source: "sheet",
        applied_at: parsedDate,
      });
      existingKeys.add(key);
      imported++;
    }

    return NextResponse.json({ imported, skipped, total: rows.length - 1 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import." },
      { status: 500 },
    );
  }
});
