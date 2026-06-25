import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/jobs")) {
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

  return NextResponse.next();
}

export const config = {
  matcher: "/api/jobs/:path*",
};
