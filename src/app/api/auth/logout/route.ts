import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await clearSession();
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(new URL("/login", origin), 303);
}
