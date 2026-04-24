import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Minimal locale routing:
 * - Only redirect `/` -> `/en`
 * - Let `/en/*` be handled by `src/app/[locale]/*`
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/en", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};