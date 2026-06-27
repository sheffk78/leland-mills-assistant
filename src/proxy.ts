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
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for auth token — NextAuth v5 uses __Secure-authjs.session-token
  // in production (HTTPS) and authjs.session-token in development
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName: "__Secure-authjs.session-token",
  });

  // Fallback: check for the non-secure cookie name too
  let finalToken = token;
  if (!finalToken) {
    finalToken = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      cookieName: "authjs.session-token",
    });
  }

  if (!finalToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes
  if (pathname.startsWith("/admin") && finalToken.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*", "/admin/:path*"],
};