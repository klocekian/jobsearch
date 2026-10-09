import { NextResponse } from "next/server";
import { getSessionUserId } from "./auth";

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Not signed in." }, { status: 401 });
}

/**
 * Route handler wrapper: answers 401 unless a user is signed in, and hands the
 * handler their id. Every query the handler runs must be scoped to that id —
 * the middleware lets /api/* through, so this is the only gate.
 */
export function withUser<Ctx = unknown>(
  handler: (request: Request, userId: number, ctx: Ctx) => Promise<Response>,
) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();
    return handler(request, userId, ctx);
  };
}
