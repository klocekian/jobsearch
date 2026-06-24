import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const SCRIPT_URL = process.env.APPS_SCRIPT_URL ?? "";

const RequestSchema = z.object({
  row: z.number().int().min(2),
  date: z.string().min(1).max(20),
});

export async function POST(request: Request) {
  if (!SCRIPT_URL) {
    return NextResponse.json(
      { error: "APPS_SCRIPT_URL is not configured. Deploy the Apps Script and set the env var." },
      { status: 500 }
    );
  }

  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body: unknown = await request.json();
    parsed = RequestSchema.parse(body);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row: parsed.row, date: parsed.date }),
      redirect: "follow",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Apps Script returned ${res.status}: ${text}`);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update the sheet." },
      { status: 502 }
    );
  }
}
