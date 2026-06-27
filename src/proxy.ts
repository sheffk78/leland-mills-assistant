/**
 * Next.js 16 Proxy (formerly Middleware).
 *
 * Protects /chat and /admin routes by checking for an authenticated session.
 * Unauthenticated requests are redirected to /login.
 *
 * Note: In Next.js 16, middleware was renamed to "proxy" to better reflect its
 * purpose. The functionality is the same.
 */

import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for session cookie — NextAuth v5 uses __Secure-authjs.session-token
  // in production (HTTPS) and authjs.session-token in development
  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("authjs.session-token")?.value;

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For admin routes, let the server component handle role checking
  // (the proxy can't decode the JWT without potential getToken issues)
  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*", "/admin/:path*"],
};