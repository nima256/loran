import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge gate for the admin area.
 *
 * This runs on the Edge runtime, where Prisma is unavailable, so it can only
 * check that an admin cookie is *present*. That is deliberately a fast path,
 * not the security control: the authoritative check is `requireAdmin()` in the
 * admin layout and in every `/api/v1/admin/*` handler, both of which validate
 * the token against the database. A forged cookie gets past this file and is
 * rejected a few milliseconds later by the layout.
 *
 * Its job is to keep an unauthenticated visitor from ever rendering an admin
 * screen, and to send them somewhere useful instead of a bare 401.
 */

const ADMIN_COOKIE = "loran_admin_session";
const LOGIN_PATH = "/admin/login";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // The login screen itself must stay reachable while signed out.
  if (pathname === LOGIN_PATH) {
    if (request.cookies.has(ADMIN_COOKIE)) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (request.cookies.has(ADMIN_COOKIE)) return NextResponse.next();

  const login = new URL(LOGIN_PATH, request.url);
  // Bring the administrator back to the page they asked for after signing in.
  if (pathname !== "/admin") login.searchParams.set("redirect", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Admin pages only. The `/api/v1/admin/*` handlers guard themselves with
  // `requireAdmin()` so they can answer 401 as JSON rather than redirect.
  matcher: ["/admin/:path*"],
};
