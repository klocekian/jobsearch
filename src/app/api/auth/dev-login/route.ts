import { NextResponse } from "next/server";
import { upsertUser } from "@/lib/db/users";
import { setSession } from "@/lib/auth";

export const runtime = "nodejs";

const DEMO_USER = { email: "demo@example.com", name: "Demo User" };

// Signs in as a local demo account without Google. `next dev` is the only
// place NODE_ENV is "development"; every Vercel build (preview or production)
// is "production", so this route 404s there.
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const user = await upsertUser(DEMO_USER);
  await setSession(user.id);

  return NextResponse.redirect(new URL("/jobs", request.url));
}
