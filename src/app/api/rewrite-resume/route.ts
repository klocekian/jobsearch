import { withUser } from "@/lib/api-auth";
import { aiErrorResponse, parseBody, textStreamResponse } from "@/lib/api-response";
import { RewriteInputSchema, streamResumeRewrite } from "@/lib/writing/rewrite-resume";

export const runtime = "nodejs";

export const POST = withUser(async (request, userId) => {
  const body = await parseBody(request, RewriteInputSchema);
  if (body.error) return body.error;
  try {
    return textStreamResponse(await streamResumeRewrite(userId, body.data));
  } catch (err: unknown) {
    return aiErrorResponse(err, "Failed to rewrite the resume.");
  }
});
