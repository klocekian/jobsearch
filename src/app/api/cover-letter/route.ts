import { withUser } from "@/lib/api-auth";
import { aiErrorResponse, parseBody, textStreamResponse } from "@/lib/api-response";
import { CoverLetterInputSchema, streamCoverLetter } from "@/lib/writing/cover-letter";

// Runs server-side so API keys never reach the browser.

export const runtime = "nodejs";

export const POST = withUser(async (request, userId) => {
  const body = await parseBody(request, CoverLetterInputSchema);
  if (body.error) return body.error;
  try {
    return textStreamResponse(await streamCoverLetter(userId, body.data));
  } catch (err: unknown) {
    return aiErrorResponse(err, "Failed to generate the cover letter.");
  }
});
