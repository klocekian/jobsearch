import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api-auth";
import { aiErrorResponse, parseBody } from "@/lib/api-response";
import { extractJobPosting } from "@/lib/job-extraction";

export const runtime = "nodejs";

const RequestSchema = z.object({
  text: z.string().min(1).max(100_000),
  url: z.string().max(2000).optional(),
});

export const POST = withUser(async (request, userId) => {
  const body = await parseBody(request, RequestSchema);
  if (body.error) return body.error;
  try {
    const result = await extractJobPosting(userId, body.data);
    if (!result) return NextResponse.json({ error: "Couldn't extract job details from that text." }, { status: 422 });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return aiErrorResponse(err, "Extraction failed.");
  }
});
