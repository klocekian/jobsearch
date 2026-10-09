import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api-auth";
import { aiErrorResponse, parseBody } from "@/lib/api-response";
import { parseResumeWithAI } from "@/lib/resume/parse-with-ai";

// The client persists the result, so this runs at most once per resume.

export const runtime = "nodejs";

const RequestSchema = z.object({
  resumeText: z.string().min(1).max(60_000),
});

export const POST = withUser(async (request, userId) => {
  const body = await parseBody(request, RequestSchema);
  if (body.error) return body.error;
  try {
    return NextResponse.json({ resume: await parseResumeWithAI(userId, body.data.resumeText) });
  } catch (err: unknown) {
    return aiErrorResponse(err, "Failed to parse the resume.");
  }
});
