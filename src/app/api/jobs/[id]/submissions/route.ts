import { NextResponse } from "next/server";
import { getJob } from "@/lib/db/jobs";
import { createSubmission } from "@/lib/db/submissions";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";

const SUBMISSIONS_DIR = path.join(process.cwd(), "data", "submissions");

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Params) {
  const { id } = await ctx.params;
  const jobId = Number(id);
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) ?? "other";
    const label = (formData.get("label") as string) ?? file?.name ?? "Upload";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
    const ext = path.extname(file.name) || ".bin";
    const filename = `${jobId}-${crypto.randomUUID()}${ext}`;
    const filePath = path.join(SUBMISSIONS_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const format = ext.replace(".", "") || "bin";
    const submission = createSubmission({
      job_id: jobId,
      type,
      label,
      format,
      content: "",
      file_path: filename,
    });
    return NextResponse.json({ submission }, { status: 201 });
  }

  try {
    const body = (await request.json()) as {
      type?: string;
      label?: string;
      format?: string;
      content?: string;
    };
    const submission = createSubmission({
      job_id: jobId,
      type: body.type ?? "other",
      label: body.label ?? "Untitled",
      format: body.format ?? "txt",
      content: body.content ?? "",
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
