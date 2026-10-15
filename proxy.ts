import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isMalformedConnectionPath } from "@/lib/connection-route-policy";
import { getEmbeddableConnection } from "@/lib/embed-connections";

function unavailableEmbedResponse() {
  return new NextResponse(
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><title>Widget unavailable | HowConnected</title></head><body><main><h1>This connection widget is unavailable.</h1><p>Only reviewed HowConnected connections can be embedded.</p></main></body></html>",
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy": "frame-ancestors 'self' https:",
        "Content-Type": "text/html; charset=utf-8",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/embed/")) {
    const match = /^\/embed\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(
      request.nextUrl.pathname,
    );
    if (!match || !getEmbeddableConnection(match[1])) {
      return unavailableEmbedResponse();
    }
  }

  if (!isMalformedConnectionPath(request.nextUrl.pathname)) {
    const response = NextResponse.next();
    const isEmbed = request.nextUrl.pathname.startsWith("/embed/");

    response.headers.set(
      "Content-Security-Policy",
      isEmbed ? "frame-ancestors 'self' https:" : "frame-ancestors 'none'",
    );
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    if (isEmbed) {
      response.headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      );
    } else {
      response.headers.set("X-Frame-Options", "DENY");
    }
    return response;
  }

  return new NextResponse(
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>Connection not found | HowConnected</title></head><body><main><h1>That connection link is not valid.</h1><p>Choose two entities from the HowConnected homepage to create a new connection.</p><p><a href=\"/\">Go to HowConnected</a></p></main></body></html>",
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy": "frame-ancestors 'none'",
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-Robots-Tag": "noindex, follow",
      },
    },
  );
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
