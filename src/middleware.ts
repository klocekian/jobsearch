import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CORS for API routes (Chrome extension)
  if (pathname.startsWith("/api/jobs") || pathname.startsWith("/api/resumes")) {
    const origin = request.headers.get("origin") ?? "";
    const isExtension = origin.startsWith("chrome-extension://");
    const isLocal = origin.startsWith("http://localhost");

    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": isExtension || isLocal ? origin : "",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const response = NextResponse.next();
    if (isExtension || isLocal) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }
    return response;
  }

  // Auth gate — redirect to login if no session cookie
  const publicPaths = ["/login", "/api/auth/", "/chrome-extension.zip"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get("jbs_session")?.value;
  if (!session && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|zip)$).*)",
  ],
};
