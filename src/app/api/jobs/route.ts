import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SHEET_ID = "1iToTfa9tSrLq70vJ4_za_hRF7qsQKivD5d5akvSr5ds";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

interface Job {
  row: number;
  company: string;
  position: string;
  date: string;
  status: string;
  url: string;
  jobText: string;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let fields: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
      if (ch === "\r") i++;
      fields.push(current);
      rows.push(fields);
      fields = [];
      current = "";
    } else {
      current += ch;
    }
  }
  if (current || fields.length) {
    fields.push(current);
    rows.push(fields);
  }
  return rows;
}

export async function GET() {
  try {
    const res = await fetch(CSV_URL, { next: { revalidate: 60 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not fetch the spreadsheet. Make sure it's shared with 'anyone with the link'." },
        { status: 502 }
      );
    }
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      return NextResponse.json({ jobs: [] });
    }

    const jobs: Job[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const company = (cols[1] ?? "").trim();
      const position = (cols[2] ?? "").trim();
      const date = (cols[3] ?? "").trim();
      const status = (cols[5] ?? "").trim();
      const url = (cols[7] ?? "").trim();
      const jobText = (cols[8] ?? "").trim();
      if (!company && !position) continue;
      jobs.push({ row: i + 1, company, position, date, status, url, jobText });
    }

    return NextResponse.json({ jobs });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load jobs." },
      { status: 500 }
    );
  }
}
