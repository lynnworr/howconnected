import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isMalformedConnectionPath } from "@/lib/connection-route-policy";

export function proxy(request: NextRequest) {
  if (!isMalformedConnectionPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return new NextResponse(
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>Connection not found | HowConnected</title></head><body><main><h1>That connection link is not valid.</h1><p>Choose two entities from the HowConnected homepage to create a new connection.</p><p><a href=\"/\">Go to HowConnected</a></p></main></body></html>",
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex, follow",
      },
    },
  );
}

export const config = {
  matcher: "/connect/:path*",
};
