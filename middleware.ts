import { type NextRequest, NextResponse } from "next/server";

// EdgeOne Pages (opennextjs-pages) currently chokes on the full Supabase
// session-refresh middleware under Next.js 16 ("s is not a function" coming
// from request.cookies.set). We move the responsibility into per-route
// checks: every server page / API route does its own
// `createClient().auth.getUser()` and redirects / returns 401 itself.
// To opt out of EdgeOne's middleware runner we just pass the request
// through unchanged.
export function middleware(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
