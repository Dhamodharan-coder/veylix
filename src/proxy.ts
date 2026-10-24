import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check only (cookie present?). Real verification happens in
// requireUser() and in every Server Action.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    // An invalid/expired email-verification link lands here as /dashboard?error=…
    const error = request.nextUrl.searchParams.get("error");
    const target = error ? `/verify-email?error=${encodeURIComponent(error)}` : "/sign-in";
    return NextResponse.redirect(new URL(target, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/settings/:path*", "/vault/:path*"],
};
