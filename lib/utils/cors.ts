/**
 * CORS utility — same allowlist as vectorial-social-wall-posts.
 *
 * Allowed origins:
 * - localhost:3000 and *.localhost:3000
 * - *.runvectorial.com
 */

import { NextRequest, NextResponse } from "next/server";

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    const port = url.port;

    if (port === "3000" && (hostname === "localhost" || hostname.endsWith(".localhost"))) {
      return true;
    }

    if (hostname === "runvectorial.com" || hostname.endsWith(".runvectorial.com")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function getAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  return isAllowedOrigin(origin) ? origin : null;
}

export function addCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const allowedOrigin = getAllowedOrigin(request);

  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

export function handleOptions(request: NextRequest): NextResponse {
  const allowedOrigin = getAllowedOrigin(request);

  if (allowedOrigin) {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  return new NextResponse(null, { status: 403 });
}
