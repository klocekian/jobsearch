import { NextResponse } from "next/server";
import { z } from "zod";
import { listResumes, createResume } from "@/lib/db/resumes";
import { getCurrentUserId } from "@/lib/api-auth";

export const runtime = "nodejs";

const CreateSchema = z.object({
  name: z.string().max(200),
  content: z.string(),
  file_name: z.string().max(500).optional(),
  is_default: z.boolean().optional(),
  tags: z.array(z.string().max(100)).optional(),
});

export async function GET() {
  const userId = await getCurrentUserId();
  const resumes = await listResumes(userId);
  return NextResponse.json({ resumes });
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const body: unknown = await request.json();
    const data = CreateSchema.parse(body);
    const resume = await createResume(userId, data);
    return NextResponse.json({ resume }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
