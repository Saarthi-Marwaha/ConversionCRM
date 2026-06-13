import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { DEV_BYPASS_AUTH } from "@/lib/flags";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Routes that require authentication
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");

  // Auth pages — redirect logged-in users away
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  // Root of conversioncrm.co: signed-in users go straight to their
  // dashboard every time; visitors see the static marketing landing page
  // (public/landing.html) — served via an internal rewrite so the URL
  // stays "/". "Try Beta" on the landing then links to /signup.
  if (pathname === "/") {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.rewrite(new URL("/site/landing.html", request.url));
  }

  // DEV: skip the login gate so the dashboard is reachable without auth
  if (!user && isProtected && !DEV_BYPASS_AUTH) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico / favicon.svg
     * - the static marketing assets folder (/assets/*)
     * - Public API routes: /api/events, /api/widget (widget embed)
     * - Static file extensions (incl. css/js/html/txt/xml for the landing)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|assets/|robots\\.txt|sitemap\\.xml|llms\\.txt|api/events|api/widget|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|html|txt|xml|woff|woff2|ico)$).*)",
  ],
};
